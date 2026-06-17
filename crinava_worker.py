"""Module docstring."""

# CRINAVA_TELEMETRY_UPGRADE_REVISION_1
import asyncio
import os
import time
import re
import html as html_mod

import httpx
import curl_cffi.requests as reqs
from logger import BallLogger

# Global semaphore: max 5 concurrent AI calls across ALL workers
_ai_semaphore = asyncio.Semaphore(5)

# -- String constants to avoid duplication --
_NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
_NVIDIA_MODEL = "google/gemma-2-2b-it"
_HTML_PARSER = "html.parser"
_CONTENT_TYPE_JSON = "application/json"
_ACCEPT_HEADER = "application/json, text/plain, */*"
_CREX_ORIGIN = "https://crex.com"
_CREX_REFERER = "https://crex.com/"
_BALL_FEEDS_URL = "https://content.crickapi.com/commentary/v3/getBallFeeds"
_DEFAULT_BOWLER = "the bowler"
_DEFAULT_BATSMAN = "the batsman"


class CrexMatchWorker:
    """Polls the Crex JSON API for real-time ball-by-ball updates.

    Player mapping strategy:
      1. HTML scrape of Crex scorecard/playing11/match-info pages
      2. Recursive getSC4 JSON mining
      3. Recursive getSV3 JSON mining
      4. Recursive ball-feed mining

    The important fix is recursive JSON mining. Crex HTML often links only
    16-18 players, while the APIs/feed payloads expose the missing IDs later.
    """

    def __init__(self, match_data, ai_api_key):
        """Docstring for __init__."""
        self.match = match_data
        self.crex_id = match_data.get("match_id")
        self.raw_id = self.crex_id.replace("CREX_", "")
        self.is_running = True
        self.last_ball_key = None
        self.ai_api_key = ai_api_key
        self.logger = BallLogger(self.crex_id)
        self.session = reqs.Session(impersonate="chrome120")

        self.api_url = f"https://api.goscorer.com/api/v3/getSV3?key={self.raw_id}"
        self.scorecard_url = f"https://api.goscorer.com/api/v3/getSC4?key={self.raw_id}"

        self.feed_items = []
        self.last_stat_id = 0
        self.seen_feed_ids: set[str] = set()
        self.feed_raw_by_key: dict[str, str] = {}
        self.feed_recheck_tasks: dict[str, asyncio.Task] = {}
        self.running_tasks = {}
        self.max_history_items = 250
        self.latest_scorecard_snapshot: dict = {}
        self.latest_sv3_snapshot: dict = {}
        self.last_win_predictor: dict = {}
        self.last_ai_win_context: dict = {}
        self.recent_ai_openings: list[str] = []

        # player_map: normalized short_id -> full_name
        self.player_map: dict[str, str] = {}
        self.mappings_fetched = False
        self._last_logged_map_size = 0
        self._printed_log_keys: set[str] = set()
        self.ball_states_history = []

    # ------------------------------------------------------------------
    # PLAYER MAPPING HELPERS
    # ------------------------------------------------------------------

    def _norm_pid(self, pid) -> str:
        """Docstring for _norm_pid."""
        return str(pid).strip().upper() if pid is not None else ""

    def _looks_like_name(self, value) -> bool:
        """Docstring for _looks_like_name."""
        value = str(value or "").strip()
        if not value:
            return False
        if re.fullmatch(r"[A-Za-z0-9]{1,6}", value):
            return False
        if len(value) > 70:
            return False
        return bool(re.search(r"[A-Za-z]", value))

    def _add_player_mapping(self, pid, pname, source: str = "JSON") -> bool:
        """Docstring for _add_player_mapping."""
        pid = self._norm_pid(pid)
        pname = str(pname or "").strip()

        if not pid or not self._looks_like_name(pname):
            return False

        if pid not in self.player_map:
            self.player_map[pid] = pname
            self.mappings_fetched = True
            return True

        return False

    def _mine_any_json_for_players(self, obj, source: str = "JSON") -> int:
        """Recursively mine player id -> name from any nested Crex/CrickAPI
        payload.

        This catches structures missed by fixed sections like
        innings['batsmen'].
        """
        id_keys = {
            "id",
            "pid",
            "pId",
            "playerId",
            "player_id",
            "f_key",
            "fkey",
            "pFkey",
            "pfkey",
            "batsmanId",
            "bowlerId",
            "strikerId",
            "nonStrikerId",
            "batId",
            "bowlId",
            "fielderId",
        }
        name_keys = {
            "name",
            "fullName",
            "playerName",
            "shortName",
            "displayName",
            "display_name",
            "batName",
            "bowlName",
            "batsmanName",
            "bowlerName",
            "strikerName",
            "nonStrikerName",
            "fielderName",
            "pName",
            "p_name",
            "n",
        }

        added = 0

        if isinstance(obj, dict):
            possible_ids = []
            possible_names = []

            for key, value in obj.items():
                if key in id_keys and value:
                    possible_ids.append(value)
                if key in name_keys and self._looks_like_name(value):
                    possible_names.append(value)

            for pid in possible_ids:
                for pname in possible_names:
                    if self._add_player_mapping(pid, pname, source):
                        added += 1
                        break

            # Common paired patterns that appear in cricket feeds.
            paired_keys = [
                ("batsmanId", "batsmanName"),
                ("bowlerId", "bowlerName"),
                ("strikerId", "strikerName"),
                ("nonStrikerId", "nonStrikerName"),
                ("fielderId", "fielderName"),
                ("batId", "batName"),
                ("bowlId", "bowlName"),
                ("playerId", "playerName"),
                ("pid", "playerName"),
                ("f_key", "n"),
                ("fkey", "n"),
                ("pFkey", "pName"),
                ("pFkey", "p_name"),
                ("id", "name"),
                ("id", "fullName"),
                ("id", "displayName"),
                ("id", "n"),
            ]
            for pid_key, name_key in paired_keys:
                if pid_key in obj and name_key in obj and self._add_player_mapping(
                    obj.get(pid_key), obj.get(name_key), source
                ):
                    added += 1

            for value in obj.values():
                added += self._mine_any_json_for_players(value, source)

        elif isinstance(obj, list):
            for item in obj:
                added += self._mine_any_json_for_players(item, source)

        return added

    def _log_new_player_total(self, source: str, added: int) -> None:
        """Docstring for _log_new_player_total."""
        if added <= 0:
            return

        total = len(self.player_map)
        if total > self._last_logged_map_size:
            if self._last_logged_map_size == 0:
                print(f"[Worker] OK [{self.crex_id}] {source} mapped {total} players")
                for pid, pname in list(self.player_map.items())[:3]:
                    print(f"  {pid} -> {pname}")
            else:
                diff = total - self._last_logged_map_size
                print(
                    f"[Worker] [{self.crex_id}] +{diff} new via {source} (total {total})"
                )

            self._last_logged_map_size = total

    def _print_once(self, key: str, message: str) -> None:
        """Docstring for _print_once."""
        if key in self._printed_log_keys:
            return
        self._printed_log_keys.add(key)
        print(message)

    def _clean_ai_text(self, text: str) -> str:
        """Docstring for _clean_ai_text."""
        text = html_mod.unescape(str(text or "")).strip()
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"^\s*(Commentary|Stat Card)\s*:\s*", "", text, flags=re.I)
        text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
        text = re.sub(r"__(.*?)__", r"\1", text)
        text = re.sub(r"`([^`]*)`", r"\1", text)
        text = re.sub(r"(?<!\w)\*(?!\s)([^*\n]+)\*", r"\1", text)
        text = re.sub(r"(?m)^\s*[-*]\s+", "", text)
        text = re.sub(r"(?m)^\s{0,3}#{1,6}\s*", "", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _remember_ai_opening(self, text: str) -> None:
        """Docstring for _remember_ai_opening."""
        words = re.findall(r"[A-Za-z0-9']+", str(text or ""))
        if not words:
            return
        opening = " ".join(words[:5]).lower()
        if opening and (
            not self.recent_ai_openings or self.recent_ai_openings[-1] != opening
        ):
            self.recent_ai_openings.append(opening)
            self.recent_ai_openings = self.recent_ai_openings[-8:]

    def _current_telemetry(self) -> dict:
        """Docstring for _current_telemetry."""
        if isinstance(self.latest_scorecard_snapshot, dict):
            telemetry = self.latest_scorecard_snapshot.get("telemetry")
            if isinstance(telemetry, dict):
                return telemetry
        return {}

    def _attach_live_context(self, packet: dict) -> dict:
        """Docstring for _attach_live_context."""
        telemetry = self._current_telemetry()
        if telemetry:
            packet["telemetry"] = telemetry
        if (
            isinstance(self.latest_scorecard_snapshot, dict)
            and self.latest_scorecard_snapshot
        ):
            packet["scorecard_cache"] = {
                "data": self.latest_scorecard_snapshot.get("innings", []),
                "telemetry": telemetry,
                "extras": self.latest_scorecard_snapshot.get("extras", []),
            }
        return packet

    def _clean_feed_text(self, raw_text) -> str:
        """Docstring for _clean_feed_text."""
        text = str(raw_text or "")
        text = (
            text.replace("&l;", "<")
            .replace("&g;", ">")
            .replace("&q;", '"')
            .replace("&a;", "&")
            .replace("&s;", "'")
        )
        text = html_mod.unescape(text)
        text = re.sub(r"<br\s*/?>", " ", text, flags=re.I)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _feed_item_key(self, item: dict, raw_text: str) -> str:
        """Docstring for _feed_item_key."""
        item_id = item.get("id")
        if item_id is not None:
            return f"feed:{self.crex_id}:{item_id}"
        return f"feed:{self.crex_id}:{item.get('type')}:{item.get('o')}:{raw_text[:80]}"

    def _classify_text_update(
        self, raw_text: str, item_id=None
    ) -> tuple[str, str, list[str]]:
        """Docstring for _classify_text_update."""
        lower = raw_text.lower()
        suffix = (
            str(item_id)[-6:] if item_id is not None else str(abs(hash(raw_text)))[-6:]
        )
        if any(word in lower for word in ["toss", "opt to", "elected to", "choose to"]):
            return f"UPDATE_TOSS_{suffix}", "INFO", ["toss"]
        if any(
            word in lower
            for word in [
                "strategic timeout",
                "drinks",
                "timeout",
                "innings break",
                "break",
            ]
        ):
            return f"UPDATE_BREAK_{suffix}", "INFO", ["break"]
        if any(
            word in lower
            for word in ["rain", "covers", "delay", "inspection", "wet outfield"]
        ):
            return f"UPDATE_RAIN_{suffix}", "INFO", ["weather"]
        if any(
            word in lower
            for word in [
                "post-match",
                "presentation",
                "potm",
                "player of the match",
                "captain):",
                "(captain)",
            ]
        ):
            return f"UPDATE_PRESENTATION_{suffix}", "INFO", ["quote"]
        if any(word in lower for word in ["wicket", "dismissed", "gone", "out!"]):
            return f"UPDATE_WICKET_{suffix}", "INFO", ["wicket"]
        if any(
            word in lower
            for word in [
                "stat",
                "most ",
                "fastest",
                "highest",
                "milestone",
                "partnership",
                "instances",
            ]
        ):
            return f"UPDATE_STAT_{suffix}", "STAT", ["stat"]
        return f"UPDATE_INFO_{suffix}", "INFO", ["update"]

    def _extract_feed_payload(self, item: dict) -> tuple[str, str, str, list[str]]:
        """Docstring for _extract_feed_payload."""
        item_type = item.get("type", "")
        if item_type == "b":
            c1 = self._clean_feed_text(item.get("c1", ""))
            c2 = self._clean_feed_text(item.get("c2", ""))
            raw_text = f"{c1} - {c2}" if c1 and c2 else (c2 or c1)
            return (
                raw_text,
                str(item.get("o") or "BALL"),
                str(item.get("b") or item.get("r") or ""),
                ["ball"],
            )

        raw_text = self._clean_feed_text(
            item.get("c") or item.get("c1") or item.get("c2") or ""
        )
        over_ball, runs, flavor = self._classify_text_update(raw_text, item.get("id"))
        return raw_text, over_ball, runs, flavor

    def _is_player_id_token(self, value) -> bool:
        """Docstring for _is_player_id_token."""
        value = self._norm_pid(value)
        return bool(re.fullmatch(r"[A-Z0-9]{1,8}", value))

    def _add_token(self, ids: set[str], value) -> None:
        """Docstring for _add_token."""
        value = self._norm_pid(value)
        if self._is_player_id_token(value):
            ids.add(value)

    def _extract_sc4_player_ids(self, sc4_data) -> set[str]:
        """GetSC4 is compressed.

        It contains every scorecard player ID, but not player names.
        Crex frontend translates these IDs by calling
        oc.crickapi.com/mapping/getHomeMapData. This extractor collects
        only ID positions, avoiding score/runs/balls fields as much as
        possible.
        """
        ids: set[str] = set()
        if isinstance(sc4_data, list):
            innings_list = sc4_data
        elif isinstance(sc4_data, dict):
            innings_list = sc4_data.get("innings", [])
        else:
            innings_list = []
        if not isinstance(innings_list, list):
            return ids

        for innings in innings_list:
            if not isinstance(innings, dict):
                continue

            # Bowlers: "playerId.overs/runs/wickets/..."
            for row in innings.get("a") or []:
                parts = str(row).split(".")
                if parts:
                    self._add_token(ids, parts[0])

            # Batters: "playerId.runs.balls.4s.6s....bowlerId.fielderId/..."
            for row in innings.get("b") or []:
                parts = str(row).split(".")
                if parts:
                    self._add_token(ids, parts[0])
                if len(parts) > 8:
                    self._add_token(ids, parts[8])
                if len(parts) > 9:
                    self._add_token(ids, parts[9].split("/")[0])

            # Partnerships: "player1.runs.balls.player2.runs.balls..."
            for row in innings.get("p") or []:
                parts = str(row).split(".")
                if len(parts) > 0:
                    self._add_token(ids, parts[0])
                if len(parts) > 3:
                    self._add_token(ids, parts[3])

            # Current/last batters: "id.id"
            for key in ("i", "x"):
                raw = innings.get(key)
                if raw:
                    for token in re.split(r"[/._-]+", str(raw)):
                        self._add_token(ids, token)

            # Impact-player style: "M-7_3.650_2/F-2X_1.5VO_4"
            raw_impact = innings.get("im")
            if raw_impact:
                for token in re.findall(
                    r"(?:^|[-./])([A-Za-z0-9]{1,8})_", str(raw_impact)
                ):
                    self._add_token(ids, token)

        return ids

    def _balls_to_overs(self, balls) -> str:
        """Docstring for _balls_to_overs."""
        try:
            balls = int(float(str(balls or "0")))
            return f"{balls // 6}.{balls % 6}"
        except Exception:
            return "-"

    def _parse_extras(self, raw) -> dict:
        """Docstring for _parse_extras."""
        text = str(raw or "").strip()
        extras = {
            "total": 0,
            "byes": 0,
            "legByes": 0,
            "wides": 0,
            "noBalls": 0,
            "penalty": 0,
        }
        if not text:
            return extras

        detailed = re.search(
            r"(\d+)\s*\(\s*b\s*(\d+),\s*lb\s*(\d+),\s*w\s*(\d+),\s*nb\s*(\d+)(?:,\s*p\s*(\d+))?",
            text,
            flags=re.I,
        )
        if detailed:
            extras.update(
                {
                    "total": int(detailed.group(1)),
                    "byes": int(detailed.group(2)),
                    "legByes": int(detailed.group(3)),
                    "wides": int(detailed.group(4)),
                    "noBalls": int(detailed.group(5)),
                    "penalty": int(detailed.group(6) or 0),
                }
            )
            return extras

        parts = [p for p in re.split(r"[./|,\s]+", text) if p != ""]
        if len(parts) >= 4 and all(p.isdigit() for p in parts[:5]):
            extras["byes"] = int(parts[0])
            extras["legByes"] = int(parts[1])
            extras["wides"] = int(parts[2])
            extras["noBalls"] = int(parts[3])
            extras["penalty"] = int(parts[4]) if len(parts) > 4 else 0
            extras["total"] = (
                extras["byes"]
                + extras["legByes"]
                + extras["wides"]
                + extras["noBalls"]
                + extras["penalty"]
            )
            return extras

        first_number = re.search(r"\d+", text)
        if first_number:
            extras["total"] = int(first_number.group(0))
        return extras

    def _score_from_innings(self, innings: dict) -> tuple[str, str, str]:
        """Docstring for _score_from_innings."""
        score_text = str(innings.get("d") or "")
        m = re.search(r"(\d+)[/-](\d+)\(([\d.]+)", score_text)
        if m:
            return m.group(1), m.group(2), m.group(3)
        return (
            str(innings.get("r", "-")),
            str(innings.get("w", "-")),
            self._balls_to_overs(str(innings.get("o", "0"))),
        )

    def _parse_sc4_scorecard(self, sc_data) -> dict:
        """Docstring for _parse_sc4_scorecard."""
        innings_list = (
            sc_data
            if isinstance(sc_data, list)
            else sc_data.get("innings", [])
            if isinstance(sc_data, dict)
            else []
        )
        parsed_innings = []
        all_extras = []
        dismissal_timeline = []
        active_ids = []

        for innings_index, inn in enumerate(innings_list, start=1):
            if not isinstance(inn, dict):
                continue

            runs, wickets, overs = self._score_from_innings(inn)
            parsed_inn = {
                "inning": innings_index,
                "tn": inn.get("c") or inn.get("tn"),
                "runs": runs,
                "wickets": wickets,
                "overs": overs,
                "extras": self._parse_extras(inn.get("e") or inn.get("extras")),
                "batters": [],
                "bowlers": [],
                "partnerships": [],
                "dismissal_timeline": [],
                "yet_to_bat": [],
            }
            all_extras.append(parsed_inn["extras"])

            for row in inn.get("b", []) or []:
                parts = str(row).split(".")
                if not parts:
                    continue
                pid = self._norm_pid(parts[0])
                if not re.match(r"^[a-zA-Z0-9_-]+$", pid):
                    continue
                runs_scored = parts[1].split("/")[0] if len(parts) > 1 else "0"
                balls = parts[2].split("/")[0] if len(parts) > 2 else "0"
                fours = parts[3].split("/")[0] if len(parts) > 3 else "0"
                sixes = parts[4].split("/")[0] if len(parts) > 4 else "0"
                try:
                    strike_rate = (
                        f"{(float(runs_scored) / float(balls)) * 100:.1f}"
                        if float(balls) > 0
                        else "0.0"
                    )
                except Exception:
                    strike_rate = "-"

                dismissal_type = parts[6] if len(parts) > 6 else ""
                wicket_bowler = self._norm_pid(parts[8]) if len(parts) > 8 else ""
                wicket_fielder = (
                    self._norm_pid(parts[9].split("/")[0]) if len(parts) > 9 else ""
                )
                batter = {
                    "id": pid,
                    "n": self.player_map.get(pid, pid),
                    "r": runs_scored,
                    "b": balls,
                    "f": fours,
                    "s": sixes,
                    "sr": strike_rate,
                    "dismissal_type": dismissal_type,
                    "wicket_bowler": wicket_bowler,
                    "wicket_fielder": wicket_fielder,
                }
                parsed_inn["batters"].append(batter)
                if wicket_bowler:
                    dismissal = {
                        "inning": innings_index,
                        "player_id": pid,
                        "player": self.player_map.get(pid, pid),
                        "bowler_id": wicket_bowler,
                        "bowler": self.player_map.get(wicket_bowler, wicket_bowler),
                        "fielder_id": wicket_fielder,
                        "fielder": self.player_map.get(wicket_fielder, wicket_fielder)
                        if wicket_fielder
                        else "",
                    }
                    parsed_inn["dismissal_timeline"].append(dismissal)
                    dismissal_timeline.append(dismissal)

            for row in inn.get("a") or inn.get("bo") or []:
                parts = str(row).split(".")
                if not parts:
                    continue
                pid = self._norm_pid(parts[0])
                if not re.match(r"^[a-zA-Z0-9_-]+$", pid):
                    continue
                runs_conceded = parts[1].split("/")[0] if len(parts) > 1 else "0"
                balls_bowled = parts[2].split("/")[0] if len(parts) > 2 else "0"
                maidens = parts[3].split("/")[0] if len(parts) > 3 else "0"
                wickets_taken = parts[4] if len(parts) > 4 else "0"
                try:
                    economy = (
                        f"{float(runs_conceded) / (float(balls_bowled) / 6):.1f}"
                        if float(balls_bowled) > 0
                        else "0.0"
                    )
                except Exception:
                    economy = "-"
                parsed_inn["bowlers"].append(
                    {
                        "id": pid,
                        "n": self.player_map.get(pid, pid),
                        "o": self._balls_to_overs(balls_bowled),
                        "balls": balls_bowled,
                        "m": maidens,
                        "r": runs_conceded,
                        "w": wickets_taken,
                        "e": economy,
                    }
                )

            for row in inn.get("p", []) or []:
                parts = str(row).split(".")
                if len(parts) >= 8:
                    p1 = self._norm_pid(parts[0])
                    p2 = self._norm_pid(parts[3])
                    parsed_inn["partnerships"].append(
                        {
                            "p1_id": p1,
                            "p1": self.player_map.get(p1, p1),
                            "p1_runs": parts[1],
                            "p1_balls": parts[2],
                            "p2_id": p2,
                            "p2": self.player_map.get(p2, p2),
                            "p2_runs": parts[4],
                            "p2_balls": parts[5],
                            "runs": parts[6],
                            "balls": parts[7],
                        }
                    )

            for raw in [inn.get("x"), inn.get("i")]:
                if raw:
                    for token in re.split(r"[/._-]+", str(raw)):
                        token = self._norm_pid(token)
                        if self._is_player_id_token(token):
                            active_ids.append(token)

            parsed_innings.append(parsed_inn)

        active_players = self._derive_active_players(parsed_innings, active_ids)
        telemetry = {
            "active": active_players,
            "striker": active_players.get("striker"),
            "non_striker": active_players.get("non_striker"),
            "bowler": active_players.get("bowler"),
            "extras": all_extras[-1] if all_extras else self._parse_extras(""),
            "recent_balls": self._recent_ball_outcomes(),
            "dismissal_timeline": dismissal_timeline,
        }
        return {"innings": parsed_innings, "telemetry": telemetry, "extras": all_extras}

    def _derive_active_players(self, innings: list, active_ids: list[str]) -> dict:
        """Docstring for _derive_active_players."""
        latest = innings[-1] if innings else {}
        batters = latest.get("batters", [])
        bowlers = latest.get("bowlers", [])

        # Find batters who are not out
        not_out_batters = [
            b for b in batters if not b.get("wicket_bowler") and b.get("r") != "-"
        ]

        striker = None
        non_striker = None
        if len(not_out_batters) > 0:
            striker = not_out_batters[-1]
        if len(not_out_batters) > 1:
            non_striker = not_out_batters[-2]

        # Fallback
        if not striker and batters:
            striker = batters[-1]
        if not non_striker and len(batters) > 1:
            non_striker = batters[-2]

        current_bowler_id = ""
        for item in self.feed_items:
            if isinstance(item, dict) and item.get("type") == "b" and item.get("c1"):
                m = re.search(
                    r"([A-Za-z0-9][A-Za-z0-9\s'.-]{1,35})\s+to\s+",
                    self._clean_feed_text(item.get("c1")),
                )
                if m:
                    name_or_id = m.group(1).strip()
                    current_bowler_id = self._norm_pid(name_or_id)
                    for pid, pname in self.player_map.items():
                        if pname.lower() == name_or_id.lower():
                            current_bowler_id = pid
                            break
                    break
        bowler = next((b for b in bowlers if b.get("id") == current_bowler_id), None)
        if not bowler and bowlers:
            bowler = bowlers[-1]

        return {
            "striker": striker,
            "non_striker": non_striker,
            "bowler": bowler,
        }

    def _recent_ball_outcomes(self, limit: int = 6) -> list[str]:
        """Docstring for _recent_ball_outcomes."""
        outcomes = []
        for item in self.feed_items:
            if isinstance(item, dict) and item.get("type") == "b":
                value = str(item.get("b") or item.get("r") or "").strip()
                if value:
                    outcomes.append(value)
                if len(outcomes) >= limit:
                    break
        return list(reversed(outcomes))

    def _phase_from_score(self, score: str) -> str:
        """Docstring for _phase_from_score."""
        m = re.search(r"\((\d+)(?:\.(\d+))?", str(score or ""))
        if not m:
            return "unknown phase"
        over = int(m.group(1))
        title = self.match.get("title", "").lower()
        if "test" in title:
            return "long-form passage"
        if over < 6:
            return "powerplay"
        if over < 15:
            return "middle overs"
        return "death overs"

    def _win_probability_value(self, win_data: dict | list | None = None):
        """Docstring for _win_probability_value."""
        win_data = win_data if win_data is not None else self.last_win_predictor
        if isinstance(win_data, list) and win_data:
            win_data = win_data[0]
        if not isinstance(win_data, dict):
            return None
        for key in ("win_probability", "winA", "batting_win_probability"):
            if key in win_data:
                try:
                    return float(win_data[key])
                except Exception:
                    return None
        return None

    def _should_inject_win_context(self) -> bool:
        """Docstring for _should_inject_win_context."""
        current = self._win_probability_value()
        if current is None:
            return False
        previous = self._win_probability_value(self.last_ai_win_context)
        if previous is None or abs(current - previous) >= 6:
            self.last_ai_win_context = dict(self.last_win_predictor)
            return True
        return False

    def _build_ai_context(self, score: str = "") -> str:
        """Docstring for _build_ai_context."""
        telemetry = (
            self.latest_scorecard_snapshot.get("telemetry", {})
            if isinstance(self.latest_scorecard_snapshot, dict)
            else {}
        )
        striker = telemetry.get("striker") or {}
        non_striker = telemetry.get("non_striker") or {}
        bowler = telemetry.get("bowler") or {}
        extras = telemetry.get("extras") or {}
        recent_balls = telemetry.get("recent_balls") or self._recent_ball_outcomes()

        lines = [
            f"Match phase: {self._phase_from_score(score)}.",
            f"Recent balls: {recent_balls or 'not enough data yet'}.",
        ]
        if striker:
            lines.append(
                f"Striker: {striker.get('n')} {striker.get('r')} off {striker.get('b')} balls, SR {striker.get('sr')}."
            )
        if non_striker:
            lines.append(
                f"Non-striker: {non_striker.get('n')} {non_striker.get('r')} off {non_striker.get('b')} balls."
            )
        if bowler:
            lines.append(
                f"Bowler spell: {bowler.get('n')} {bowler.get('o')}-{bowler.get('m')}-{bowler.get('r')}-{bowler.get('w')}, economy {bowler.get('e')}."
            )
        if extras and extras.get("total"):
            lines.append(
                "Extras: "
                f"{extras.get('total')} total, {extras.get('byes')} b, {extras.get('legByes')} lb, "
                f"{extras.get('wides')} w, {extras.get('noBalls')} nb."
            )
        if self._should_inject_win_context():
            win = self.last_win_predictor
            bat_team = win.get("batting_team") or win.get("teamA") or "batting side"
            bowl_team = win.get("bowling_team") or win.get("teamB") or "bowling side"
            win_value = self._win_probability_value(win)
            if win_value is not None:
                lines.append(
                    f"Momentum alert: {bat_team} win probability is now {win_value:.1f}% against {bowl_team}."
                )
        return "\n".join(lines)

    async def _fetch_player_names_for_ids(self, ids, source: str = "mapping") -> None:
        """Docstring for _fetch_player_names_for_ids."""
        missing = sorted(
            {
                self._norm_pid(pid)
                for pid in ids
                if self._is_player_id_token(pid)
                and self._norm_pid(pid) not in self.player_map
            }
        )
        if not missing:
            return

        total_added = 0
        mapping_url = "https://oc.crickapi.com/mapping/getHomeMapData"
        headers = {
            "Accept": _ACCEPT_HEADER,
            "Content-Type": _CONTENT_TYPE_JSON,
            "Origin": _CREX_ORIGIN,
            "Referer": _CREX_REFERER,
        }

        for idx in range(0, len(missing), 80):
            chunk = missing[idx : idx + 80]
            payload = {"p": chunk, "t": [], "s": [], "u": [], "v": [], "lc": "en"}
            try:
                resp = await asyncio.to_thread(
                    reqs.post,
                    mapping_url,
                    json=payload,
                    headers=headers,
                    impersonate="chrome120",
                    timeout=8,
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
                for player in data.get("p", []) if isinstance(data, dict) else []:
                    if self._add_player_mapping(
                        player.get("f_key") or player.get("fkey"),
                        player.get("n") or player.get("name"),
                        source,
                    ):
                        total_added += 1
            except Exception as e:
                print(f"[Worker] Mapping error [{self.crex_id}] {source}: {e}")

        self._log_new_player_total(source, total_added)

    # ------------------------------------------------------------------
    # PLAYER MAPPING - Layer 1: HTML scrape
    # ------------------------------------------------------------------

    async def fetch_mappings(self) -> None:
        """Docstring for fetch_mappings."""
        base_url = self.match.get("url", "")
        if not base_url:
            base_url = f"https://crex.com/cricket-live-score/unknown-match-updates-{self.raw_id}"

        def _swap_teams(base: str) -> str:
            """Docstring for _swap_teams."""
            crex_prefix = "https://crex.com/cricket-live-score/"
            if not base.startswith(crex_prefix):
                return base
            slug = base[len(crex_prefix) :]
            vs_idx = slug.find("-vs-")
            if vs_idx == -1:
                return base
            team1 = slug[:vs_idx]
            rest = slug[vs_idx + 4 :]
            m = re.search(r"-(\d)", rest)
            if not m:
                return base
            team2 = rest[: m.start()]
            remainder = rest[m.start() :]
            return f"{crex_prefix}{team2}-vs-{team1}{remainder}"

        def _info_url_from_live(url: str) -> str:
            # Crex exposes full squads on "...-119E", while live pages often use
            # "...-match-updates-119E". Both are needed.
            """Docstring for _info_url_from_live."""
            return re.sub(r"-match-updates-(?=[A-Za-z0-9]+/?$)", "-", url.rstrip("/"))

        def _candidate_urls(url: str) -> list[tuple[str, str]]:
            """Docstring for _candidate_urls."""
            raw_base = url.rstrip("/")
            info_base = _info_url_from_live(raw_base)

            # Keep the old transformed shape too, because some older Crex pages
            # used it. The main/current scorecard shape is raw_base/match-scorecard.
            old_scorecard_base = raw_base.replace("match-updates-", "scorecard-")

            bases = []
            for candidate in [
                raw_base,
                info_base,
                old_scorecard_base,
                _swap_teams(raw_base),
                _swap_teams(info_base),
                _swap_teams(old_scorecard_base),
            ]:
                if candidate and candidate not in bases:
                    bases.append(candidate)

            urls = []
            seen = set()
            for base in bases:
                for suffix, label in [
                    ("", "info"),
                    ("/match-scorecard", "scorecard"),
                    ("/playing11", "playing11"),
                    ("/match-info", "match-info"),
                    ("/info", "info-tab"),
                    ("/scorecard", "scorecard-tab"),
                ]:
                    full = base + suffix
                    if full not in seen:
                        seen.add(full)
                        urls.append((full, label))
            return urls

        urls_to_fetch = _candidate_urls(base_url)

        player_regex = re.compile(
            r"(?:/|\\/)player(?:/|\\/)((?:[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)-([A-Za-z0-9]{1,8}))(?=[^a-zA-Z0-9]|$)"
        )

        added = 0

        for url, label in urls_to_fetch:
            try:
                resp = await asyncio.to_thread(
                    self.session.request, "GET", url, timeout=10
                )
                if resp.status_code != 200:
                    continue

                html_text = resp.text.replace("\\/", "/")
                for full_slug, player_id in player_regex.findall(html_text):
                    name_slug = full_slug[: -(len(player_id) + 1)]
                    player_name = name_slug.replace("-", " ").title()
                    if self._add_player_mapping(player_id, player_name, "HTML"):
                        added += 1

            except Exception as e:
                print(f"[Worker] HTML error [{self.crex_id}] {label}: {e}")

        self._log_new_player_total("HTML", added)

    # ------------------------------------------------------------------
    # PLAYER MAPPING - JSON layers
    # ------------------------------------------------------------------

    def _mine_sc4_for_players(self, sc4_data) -> None:
        """Docstring for _mine_sc4_for_players."""
        added = self._mine_any_json_for_players(sc4_data, "SC4")
        self._log_new_player_total("SC4", added)

    def _mine_sv3_for_players(self, sv3_data: dict) -> None:
        """Docstring for _mine_sv3_for_players."""
        added = self._mine_any_json_for_players(sv3_data, "SV3")
        self._log_new_player_total("SV3", added)

    # ------------------------------------------------------------------
    # SCORECARD POLL
    # ------------------------------------------------------------------

    async def poll_scorecard(self) -> None:
        """Docstring for poll_scorecard."""
        try:
            resp = await asyncio.to_thread(
                self.session.request, "GET", self.scorecard_url, timeout=10
            )
            if resp.status_code != 200:
                return

            sc_data = resp.json()
            self._mine_sc4_for_players(sc_data)
            sc4_ids = self._extract_sc4_player_ids(sc_data)
            await self._fetch_player_names_for_ids(sc4_ids, "SC4-map")

            parsed = self._parse_sc4_scorecard(sc_data)
            parsed_innings = parsed["innings"]
            telemetry = parsed["telemetry"]
            self.latest_scorecard_snapshot = parsed

            from hub import match_hub

            if self.crex_id not in match_hub:
                match_hub[self.crex_id] = {"history": [], "queues": set()}

            payload = {
                "type": "scorecard",
                "match_id": self.crex_id,
                "data": parsed_innings,
                "raw": sc_data,
                "telemetry": telemetry,
                "extras": parsed.get("extras", []),
                "player_map": self.player_map,
            }
            match_hub[self.crex_id]["scorecard"] = payload
            match_hub[self.crex_id]["telemetry"] = telemetry
            match_hub[self.crex_id]["last_scorecard_at"] = time.time()

            for queue in match_hub[self.crex_id].get("queues", set()):
                queue.put_nowait(payload)

        except Exception as e:
            print(f"[Worker] Scorecard error [{self.crex_id}]: {e}")

    # ------------------------------------------------------------------
    # MAIN LOOP
    # ------------------------------------------------------------------

    async def listen(self) -> None:
        """Docstring for listen."""
        print(f"[Worker] Started polling: {self.match['title']} ({self.crex_id})")
        await self.fetch_mappings()
        await self.poll_scorecard()

        counter = 0
        while self.is_running:
            await self.poll_once()

            if counter % 4 == 0:
                await self.poll_scorecard()

            if counter % 24 == 0:
                await self.fetch_mappings()

            counter += 1
            await asyncio.sleep(2.5)

    # ------------------------------------------------------------------
    # BALL POLLING
    # ------------------------------------------------------------------

    async def poll_once(self) -> None:
        """Docstring for poll_once."""
        try:
            resp = await asyncio.to_thread(
                self.session.request, "GET", self.api_url, timeout=10
            )
            if resp.status_code != 200:
                return

            data = resp.json()
            self.latest_sv3_snapshot = data
            st = str(data.get("st", ""))

            # Robust State Extraction (CSK/Crex State engine)
            b_text = str(data.get("B", "")).lower()
            j_text = str(data.get("j", ""))
            k_text = str(data.get("k", ""))

            # 1. Completed check: banner indicators or API codes
            is_completed = any(
                phrase in b_text
                for phrase in [
                    "won by",
                    "won the series",
                    "tied",
                    "drawn",
                    "abandoned",
                    "no result",
                    "complete",
                    "won the match",
                    "victory",
                    "win",
                ]
            ) or st in {"2", "4"}

            # 2. Upcoming check: no scores, or explicit indicators
            is_upcoming = (
                (not j_text and not k_text)
                or "not started" in j_text.lower()
                or "not started" in k_text.lower()
                or "yet to begin" in b_text
                or "match starts" in b_text
                or st == "5"
            )

            if is_completed:
                determined_state = "Completed"
            elif is_upcoming:
                determined_state = "Upcoming"
            else:
                determined_state = "Live"

            from hub import match_hub

            if self.crex_id in match_hub:
                match_hub[self.crex_id]["state"] = determined_state

            if determined_state == "Completed":
                print(
                    f"[Worker] Match finished [{self.crex_id}] determined state=Completed (st={st}, B={b_text})"
                )
                if self.crex_id in match_hub:
                    match_hub[self.crex_id]["completed_at"] = (
                        match_hub[self.crex_id].get("completed_at") or time.time()
                    )
                    match_hub[self.crex_id]["title"] = self.match.get("title")
                    match_hub[self.crex_id]["source"] = self.match.get("source", "crex")
                    try:
                        from hub import save_cache

                        save_cache()
                    except Exception as cache_error:
                        print(
                            f"[Cache] Completed save failed for {self.crex_id}: {cache_error}"
                        )
                self.is_running = False

            self._mine_sv3_for_players(data)

            overs = data.get("rb", [])
            score_j = data.get("j", "")
            score_k = data.get("k", "")
            score_summary = f"{score_j} | {score_k}" if score_k else score_j
            current_score_str = score_k if score_k else score_j
            commentary = data.get("C", "")

            try:
                feeds_url = _BALL_FEEDS_URL
                f_payload = {"matchKey": self.raw_id, "lastDocId": None, "filters": {}}
                f_headers = {
                    "Accept": _ACCEPT_HEADER,
                    "Content-Type": _CONTENT_TYPE_JSON,
                    "authorization": os.environ.get("CREX_AUTHORIZATION_TOKEN", ""),
                    "cc": "IN",
                    "Origin": _CREX_ORIGIN,
                    "Referer": _CREX_REFERER,
                }
                resp_feeds = await asyncio.to_thread(
                    reqs.post,
                    feeds_url,
                    json=f_payload,
                    headers=f_headers,
                    impersonate="chrome120",
                    timeout=5,
                )
                if resp_feeds.status_code == 200:
                    feed_data = resp_feeds.json()
                    if isinstance(feed_data, list):
                        self.feed_items = feed_data
                        added = self._mine_any_json_for_players(feed_data, "feeds")
                        self._log_new_player_total("feeds", added)
                        await self.process_crex_feed_items(feed_data, score_summary)
            except Exception:
                pass

            if not overs:
                ball_key = "status_update"
                if ball_key != self.last_ball_key:
                    self.last_ball_key = ball_key
                    safe_score = (
                        "Match Not Started"
                        if (st == "5" or (st == "1" and not score_summary))
                        else score_summary
                    )
                    packet = {
                        "over_ball": "Finished" if st == "2" else "Live",
                        "runs_scored": "-",
                        "score": safe_score,
                        "commentary": "Match Status Update",
                    }
                    from hub import match_hub

                    if self.crex_id not in match_hub:
                        match_hub[self.crex_id] = {"history": [], "queues": set()}
                    match_hub[self.crex_id]["history"].append(packet)
                return

            latest_over_data = overs[-1]
            over_num = latest_over_data.get("o")
            balls = latest_over_data.get("b", [])
            if not balls:
                return

            latest_ball = balls[-1]
            match_over = re.search(r"\(([\d\.]+)", current_score_str)
            display_over = (
                match_over.group(1) if match_over else f"{over_num}.{len(balls)}"
            )
            ball_index = len(balls)
            ball_key = f"{display_over}_{ball_index}_{latest_ball.get('u')}"

            if ball_key != self.last_ball_key:
                self.last_ball_key = ball_key
                await self.poll_scorecard()

                has_feed_ball = any(
                    item.get("type") == "b" and str(item.get("o")) == str(display_over)
                    for item in self.feed_items
                    if isinstance(item, dict)
                )
                if has_feed_ball:
                    return

                self._print_once(
                    f"new-ball:{score_summary}:{display_over}",
                    f"[Worker] New Ball [{self.crex_id}] {display_over} -> {latest_ball.get('u')}",
                )
                ball_info = {
                    "over_ball": display_over,
                    "runs_scored": latest_ball.get("u"),
                    "score": score_summary,
                    "commentary": commentary,
                }
                await self.process_ball_update(ball_info)

        except Exception as e:
            print(f"[Worker] Poll error [{self.crex_id}]: {e}")

    # ------------------------------------------------------------------
    # STAT CARDS
    # ------------------------------------------------------------------

    async def process_crex_feed_items(
        self, feed_data: list, score_summary: str = ""
    ) -> None:
        """Broadcast every new Crex commentary feed item once: ball notes, text
        updates, toss notes, milestones, interviews, innings breaks and
        stats."""
        if not isinstance(feed_data, list):
            return

        is_startup = len(self.seen_feed_ids) == 0
        reversed_items = []

        for item in reversed(feed_data):
            if not isinstance(item, dict):
                continue
            raw_text, over_ball, runs, flavor = self._extract_feed_payload(item)
            if not raw_text:
                continue
            event_key = self._feed_item_key(item, raw_text)
            if event_key in self.seen_feed_ids:
                continue
            reversed_items.append((item, raw_text, event_key, over_ball, runs, flavor))

        for idx, (item, raw_text, event_key, over_ball, runs, flavor) in enumerate(
            reversed_items
        ):
            self.seen_feed_ids.add(event_key)
            self.feed_raw_by_key[event_key] = raw_text
            item_type = item.get("type", "")

            packet = {
                "match_id": self.crex_id,
                "event_key": event_key,
                "score": score_summary,
                "over_ball": over_ball,
                "runs_scored": runs,
                "flavor": flavor,
                "commentary": self._clean_ai_text(raw_text),
                "raw_commentary": raw_text,
                "timestamp": time.time(),
            }
            self._attach_live_context(packet)

            if item_type == "b":
                # Only hit the API for the very latest unseen ball in the startup batch
                is_last_unseen_ball = not any(
                    future_item[0].get("type") == "b"
                    for future_item in reversed_items[idx + 1 :]
                )
                skip_api = not is_last_unseen_ball

                try:
                    win_data = await asyncio.wait_for(
                        self.fetch_win_prediction(packet, skip_api_call=skip_api),
                        timeout=3.0,
                    )
                    if win_data:
                        if isinstance(win_data, list) and len(win_data) > 0:
                            packet["win_predictor"] = win_data[0]
                        elif isinstance(win_data, dict):
                            packet["win_predictor"] = win_data
                except Exception as e:
                    print(f"[WinPredictor Feed Fetch Error] {e}")

            self.logger.log_ball(packet)
            await self.broadcast_to_clients(packet)

            if self.ai_api_key:
                is_last_unseen_ball = not any(
                    future_item[0].get("type") == "b"
                    for future_item in reversed_items[idx + 1 :]
                )
                if not is_startup or is_last_unseen_ball:
                    asyncio.create_task(
                        self._refine_feed_packet(
                            packet=packet,
                            raw_text=raw_text,
                            item_type=item_type,
                            over_ball=over_ball,
                            runs=runs,
                            score_summary=score_summary,
                            feed_id=item.get("id"),
                        )
                    )

            if item_type == "b":
                self._schedule_feed_rechecks(
                    event_key, item.get("id"), over_ball, score_summary
                )

    async def _refine_feed_packet(
        self,
        packet: dict,
        raw_text: str,
        item_type: str,
        over_ball: str,
        runs: str,
        score_summary: str,
        feed_id,
    ) -> None:
        """Docstring for _refine_feed_packet."""
        try:
            async with _ai_semaphore:
                commentary = await asyncio.wait_for(
                    self.generate_feed_commentary(
                        raw_text=raw_text,
                        item_type=item_type,
                        over_ball=over_ball,
                        runs=runs,
                        score=score_summary,
                    ),
                    timeout=12.0,
                )
            packet["commentary"] = self._clean_ai_text(commentary)
            self._remember_ai_opening(packet["commentary"])
            if item_type == "b":
                try:
                    win_data = await asyncio.wait_for(
                        self.fetch_win_prediction(packet), timeout=3.0
                    )
                    if win_data:
                        if isinstance(win_data, list) and len(win_data) > 0:
                            packet["win_predictor"] = win_data[0]
                        elif isinstance(win_data, dict):
                            packet["win_predictor"] = win_data
                except Exception:
                    pass
            self._attach_live_context(packet)
            packet["timestamp"] = time.time()
            self.logger.log_ball(packet)
            await self.broadcast_to_clients(packet)
        except asyncio.TimeoutError:
            print(f"[AI Timeout] [{self.crex_id}] feed {feed_id}")
        except Exception as e:
            print(f"[AI Feed Error] [{self.crex_id}]: {e}")

    def _schedule_feed_rechecks(
        self, event_key: str, feed_id, over_ball: str, score_summary: str
    ) -> None:
        """Docstring for _schedule_feed_rechecks."""
        if event_key in self.feed_recheck_tasks:
            return
        task = asyncio.create_task(
            self._recheck_feed_item(event_key, feed_id, over_ball, score_summary)
        )
        self.feed_recheck_tasks[event_key] = task

        def _clean(_):
            """Docstring for _clean."""
            self.feed_recheck_tasks.pop(event_key, None)

        task.add_done_callback(_clean)

    async def _fetch_ball_feeds(self) -> list:
        """Docstring for _fetch_ball_feeds."""
        feeds_url = "https://content.crickapi.com/commentary/v3/getBallFeeds"
        f_payload = {"matchKey": self.raw_id, "lastDocId": None, "filters": {}}
        f_headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "authorization": os.environ.get("CREX_AUTHORIZATION_TOKEN", ""),
            "cc": "IN",
            "Origin": "https://crex.com",
            "Referer": "https://crex.com/",
        }
        resp = await asyncio.to_thread(
            reqs.post,
            feeds_url,
            json=f_payload,
            headers=f_headers,
            impersonate="chrome120",
            timeout=5,
        )
        if resp.status_code == 200 and isinstance(resp.json(), list):
            return resp.json()
        return []

    async def _recheck_feed_item(
        self, event_key: str, feed_id, over_ball: str, score_summary: str
    ) -> None:
        """Docstring for _recheck_feed_item."""
        for _ in range(10):
            await asyncio.sleep(6)
            try:
                feed_data = await self._fetch_ball_feeds()
                if not feed_data:
                    continue
                self.feed_items = feed_data
                await self.process_crex_feed_items(feed_data, score_summary)

                matched_item = None
                for item in feed_data:
                    if not isinstance(item, dict):
                        continue
                    if feed_id is not None and item.get("id") == feed_id:
                        matched_item = item
                        break
                    if (
                        feed_id is None
                        and item.get("type") == "b"
                        and str(item.get("o")) == str(over_ball)
                    ):
                        matched_item = item
                        break
                if not matched_item:
                    continue

                raw_text, updated_over, runs, flavor = self._extract_feed_payload(
                    matched_item
                )
                if not raw_text or raw_text == self.feed_raw_by_key.get(event_key):
                    continue

                self.feed_raw_by_key[event_key] = raw_text
                packet = {
                    "match_id": self.crex_id,
                    "event_key": event_key,
                    "score": score_summary,
                    "over_ball": updated_over,
                    "runs_scored": runs,
                    "flavor": flavor,
                    "commentary": self._clean_ai_text(raw_text),
                    "raw_commentary": raw_text,
                    "timestamp": time.time(),
                }
                self._attach_live_context(packet)
                if matched_item.get("type") == "b":
                    win_data = await self.fetch_win_prediction(packet)
                    if win_data:
                        packet["win_predictor"] = (
                            win_data[0]
                            if isinstance(win_data, list) and win_data
                            else win_data
                        )
                self.logger.log_ball(packet)
                await self.broadcast_to_clients(packet)
                if self.ai_api_key:
                    asyncio.create_task(
                        self._refine_feed_packet(
                            packet,
                            raw_text,
                            matched_item.get("type", ""),
                            updated_over,
                            runs,
                            score_summary,
                            feed_id,
                        )
                    )
            except Exception as e:
                print(f"[Feed Recheck Error] [{self.crex_id}] {event_key}: {e}")

    # ------------------------------------------------------------------
    # COMMENTARY MATCHING
    # ------------------------------------------------------------------

    def get_matched_commentary(self, over_ball: str) -> dict:
        """Docstring for get_matched_commentary."""
        import html as html_mod

        def clean_html(raw_html):
            """Docstring for clean_html."""
            if not raw_html:
                return ""
            return html_mod.unescape(re.sub(r"<.*?>", "", raw_html)).strip()

        search_over = str(over_ball)

        if search_over.endswith(".0"):
            try:
                major = int(search_over.split(".")[0])
                prev_prefix = str(major - 1) + "."
                for item in self.feed_items:
                    if item.get("type") == "b" and str(item.get("o", "")).startswith(
                        prev_prefix
                    ):
                        search_over = str(item.get("o"))
                        break
                else:
                    search_over = f"{major - 1}.6"
            except Exception:
                pass

        raw_commentary = ""
        exact_runs = ""
        matching_b = None
        matching_t = None

        for idx, item in enumerate(self.feed_items):
            if item.get("type") == "b" and str(item.get("o")) == search_over:
                matching_b = item
                exact_runs = str(item.get("b", ""))
                if idx - 1 >= 0 and self.feed_items[idx - 1].get("type") == "t":
                    t_item = self.feed_items[idx - 1]
                    if (t_item.get("id") or 0) > (item.get("id") or 0):
                        matching_t = t_item
                break

        if matching_b:
            c1 = clean_html(matching_b.get("c1", ""))
            c2 = clean_html(matching_b.get("c2", ""))
            raw_commentary = f"{c1} - {c2}" if (c1 and c2) else (c2 or c1)
            if matching_t:
                extra = clean_html(matching_t.get("c", ""))
                if extra:
                    raw_commentary = (
                        (raw_commentary + " " + extra).strip()
                        if raw_commentary
                        else extra
                    )

        return {"text": raw_commentary, "runs": exact_runs}

    # ------------------------------------------------------------------
    # PLAYER NAME RESOLUTION
    # ------------------------------------------------------------------

    def resolve_player_id(self, raw: str) -> str:
        """Docstring for resolve_player_id."""
        if not raw:
            return raw

        raw = str(raw).strip()
        pid = self._norm_pid(raw)

        if re.fullmatch(r"[A-Za-z0-9]{1,8}", pid):
            return self.player_map.get(pid, raw)

        return raw

    def get_current_players(self) -> tuple:
        """Docstring for get_current_players."""
        for item in self.feed_items:
            if item.get("type") != "b" or not item.get("c1"):
                continue
            c1 = item.get("c1", "")
            m = re.search(
                r"([A-Za-z0-9][A-Za-z0-9\s'\.\-]{1,35})\s+to\s+([A-Za-z0-9][A-Za-z0-9\s'\.\-]{1,35})",
                c1,
            )
            if not m:
                continue
            bowler = self.resolve_player_id(m.group(1).strip())
            batsman = self.resolve_player_id(m.group(2).strip())
            if (
                "overs" not in bowler.lower()
                and len(bowler) <= 35
                and "overs" not in batsman.lower()
                and len(batsman) <= 35
            ):
                return bowler, batsman
        return _DEFAULT_BOWLER, _DEFAULT_BATSMAN

    # ------------------------------------------------------------------
    # BALL PROCESSING
    # ------------------------------------------------------------------

    async def process_ball_update(self, ball_info: dict) -> None:
        """Docstring for process_ball_update."""
        runs = str(ball_info.get("runs_scored", ""))
        flavor = []
        if "4" in runs:
            flavor.append("boundary")
        if "6" in runs:
            flavor.append("sixer")
        if "w" in runs.lower():
            flavor.append("wicket")
        if "wd" in runs.lower():
            flavor.append("wide")

        over_ball = ball_info.get("over_ball")
        match_data = self.get_matched_commentary(over_ball)
        raw_comm = match_data.get("text", "")
        if match_data.get("runs"):
            ball_info["runs_scored"] = match_data["runs"]

        if not raw_comm:
            rv = str(ball_info.get("runs_scored", ""))
            if "w" in rv.lower():
                raw_comm = f"Wicket on {over_ball}!"
            elif "6" in rv:
                raw_comm = f"Six on {over_ball}!"
            elif "4" in rv:
                raw_comm = f"Boundary on {over_ball}!"
            elif "wd" in rv.lower():
                raw_comm = f"Wide on {over_ball}."
            elif "nb" in rv.lower():
                raw_comm = f"No ball on {over_ball}."
            else:
                raw_comm = f"Over {over_ball}: {rv} run(s)."

        ball_info["commentary"] = raw_comm

        packet = {
            "match_id": self.crex_id,
            "event_key": f"ball:{self.crex_id}:{over_ball}",
            "score": ball_info.get("score"),
            "over_ball": over_ball,
            "runs_scored": ball_info.get("runs_scored"),
            "flavor": flavor,
            "commentary": raw_comm,
            "timestamp": time.time(),
        }
        self._attach_live_context(packet)

        # Fetch win prediction instantly and update the initial packet before broadcasting
        try:
            win_data = await asyncio.wait_for(
                self.fetch_win_prediction(packet), timeout=3.0
            )
            if win_data:
                if isinstance(win_data, list) and len(win_data) > 0:
                    packet["win_predictor"] = win_data[0]
                elif isinstance(win_data, dict):
                    packet["win_predictor"] = win_data
        except Exception as e:
            print(f"[WinPredictor Instant Fetch Error] {e}")

        self.logger.log_ball(packet)
        await self.broadcast_to_clients(packet)

        async def run_ai_and_update():
            """Docstring for run_ai_and_update."""
            try:
                await asyncio.sleep(8)

                feeds_url = "https://content.crickapi.com/commentary/v3/getBallFeeds"
                f_payload = {"matchKey": self.raw_id, "lastDocId": None, "filters": {}}
                f_headers = {
                    "Accept": "application/json, text/plain, */*",
                    "Content-Type": "application/json",
                    "authorization": os.environ.get("CREX_AUTHORIZATION_TOKEN", ""),
                    "cc": "IN",
                    "Origin": "https://crex.com",
                    "Referer": "https://crex.com/",
                }
                try:
                    r2 = await asyncio.to_thread(
                        reqs.post,
                        feeds_url,
                        json=f_payload,
                        headers=f_headers,
                        impersonate="chrome120",
                        timeout=5,
                    )
                    if r2.status_code == 200 and isinstance(r2.json(), list):
                        self.feed_items = r2.json()
                        added = self._mine_any_json_for_players(
                            self.feed_items, "feeds"
                        )
                        self._log_new_player_total("feeds", added)
                        await self.process_crex_feed_items(
                            self.feed_items,
                            packet.get("score") or ball_info.get("score") or "",
                        )
                except Exception:
                    pass

                updated = self.get_matched_commentary(over_ball)
                if updated.get("runs"):
                    packet["runs_scored"] = updated["runs"]
                    tr = str(packet["runs_scored"])
                    nf = []
                    if "4" in tr:
                        nf.append("boundary")
                    if "6" in tr:
                        nf.append("sixer")
                    if "w" in tr.lower():
                        nf.append("wicket")
                    if "wd" in tr.lower():
                        nf.append("wide")
                    packet["flavor"] = nf

                updated_comm = updated.get("text") or raw_comm
                ball_info["commentary"] = updated_comm

                # Fetch updated win prediction to account for final processed ball states/runs/wickets
                try:
                    win_data = await asyncio.wait_for(
                        self.fetch_win_prediction(packet), timeout=3.0
                    )
                    if win_data:
                        if isinstance(win_data, list) and len(win_data) > 0:
                            packet["win_predictor"] = win_data[0]
                        elif isinstance(win_data, dict):
                            packet["win_predictor"] = win_data
                except Exception:
                    pass

                try:
                    async with _ai_semaphore:
                        ai_comm = await asyncio.wait_for(
                            self.generate_ai_commentary(ball_info), timeout=9.0
                        )
                except asyncio.TimeoutError:
                    ai_comm = updated_comm
                    print(f"[AI Timeout] [{self.crex_id}] over {over_ball}")

                packet["commentary"] = ai_comm
                self._remember_ai_opening(ai_comm)
                self.logger.log_ball(packet)

                from hub import match_hub

                if self.crex_id in match_hub:
                    for i, p in enumerate(match_hub[self.crex_id].get("history", [])):
                        if p.get("over_ball") == packet["over_ball"]:
                            match_hub[self.crex_id]["history"][i] = packet
                            break

                await self.broadcast_to_clients(packet)

            except Exception as e:
                print(f"[AI Error] [{self.crex_id}]: {e}")

        if self.ai_api_key:
            if over_ball in self.running_tasks:
                try:
                    self.running_tasks[over_ball].cancel()
                except Exception:
                    pass
            task = asyncio.create_task(run_ai_and_update())
            self.running_tasks[over_ball] = task

            def _clean(t):
                """Docstring for _clean."""
                if self.running_tasks.get(over_ball) == t:
                    self.running_tasks.pop(over_ball, None)

            task.add_done_callback(_clean)

    async def fetch_win_prediction(
        self, packet: dict, skip_api_call: bool = False
    ) -> dict:
        """Docstring for fetch_win_prediction."""
        try:
            score_summary = packet.get("score", "")
            if not score_summary:
                return {}

            # Extract active score (e.g. from "142/4 | 134/2" or "142-4")
            parts = [s.strip() for s in score_summary.split("|")]
            active_score = parts[-1] if parts else ""

            m_score = re.search(r"(\d+)(?:[/-](\d+))?", active_score)
            if not m_score:
                return {}

            cumulative_runs = int(m_score.group(1))
            cumulative_wkts = (
                int(m_score.group(2))
                if m_score.group(2)
                else (10 if "all out" in active_score.lower() else 0)
            )

            over_ball = packet.get("over_ball", "0.0")
            over_no, ball_no = 0, 0
            try:
                if "." in str(over_ball):
                    over_no = int(str(over_ball).split(".")[0])
                    ball_no = int(str(over_ball).split(".")[1])
            except Exception:
                pass

            legal_balls_bowled = over_no * 6 + ball_no
            innings_no = len(parts)
            target = 0
            runs_needed = 0
            if innings_no > 1:
                m1 = re.search(r"(\d+)(?:[/-](\d+))?", parts[0])
                if m1:
                    target = int(m1.group(1)) + 1
                    runs_needed = max(0, target - cumulative_runs)

            title_lower = self.match.get("title", "").lower()
            if any(
                kw in title_lower for kw in ["odi", "50 overs", "list a", "one day"]
            ):
                match_format = "ODI"
                total_innings_balls = 300
            elif any(
                kw in title_lower
                for kw in ["t10", "10 overs", "t-10", "10-over", "ten-ten"]
            ):
                match_format = "T10"
                total_innings_balls = 60
            else:
                match_format = "T20"
                total_innings_balls = 120

            balls_remaining = max(0, total_innings_balls - legal_balls_bowled)
            wickets_left = max(0, 10 - cumulative_wkts)

            rrr = (runs_needed / balls_remaining) * 6 if balls_remaining > 0 else 0.0
            crr = (
                (cumulative_runs / legal_balls_bowled) * 6
                if legal_balls_bowled > 0
                else 0.0
            )

            roll6_runs = 0
            roll6_wkts = 0
            legal_count = 0
            for item in self.feed_items:
                if item.get("type") == "b":
                    runs = str(item.get("b", "") or item.get("r", ""))
                    if "w" in runs.lower() and "wd" not in runs.lower():
                        roll6_wkts += 1
                    try:
                        digits = re.search(r"\d+", runs)
                        if digits:
                            roll6_runs += int(digits.group(0))
                    except Exception:
                        pass
                    if "wd" not in runs.lower() and "nb" not in runs.lower():
                        legal_count += 1
                    if legal_count >= 6:
                        break

            # Smart Capitalized Team Name Extraction
            t1_name = "Team 1"
            t2_name = "Team 2"
            teams = self.match.get("teams", [])
            if isinstance(teams, list) and len(teams) >= 2:
                t1_name = str(teams[0]).title()
                t2_name = str(teams[1]).title()
            else:
                title = self.match.get("title", "")
                if " vs " in title.lower():
                    parts_title = re.split(r"\s+vs\s+", title, flags=re.IGNORECASE)
                    if len(parts_title) >= 2:
                        t1_name = parts_title[0].strip()
                        t2_part = parts_title[1].strip()
                        t2_words = t2_part.split(" ")
                        if len(t2_words) > 0:
                            t2_name = t2_words[0].strip()

            batting_team = t2_name if innings_no > 1 else t1_name
            bowling_team = t1_name if innings_no > 1 else t2_name

            from hub import match_hub

            sc = match_hub.get(self.crex_id, {}).get("scorecard", {}).get("data")
            if sc:
                innings_list = sc if isinstance(sc, list) else sc.get("innings", [])
                if len(innings_list) >= innings_no:
                    curr_inn = innings_list[innings_no - 1]
                    tn_id = curr_inn.get("tn")
                    if tn_id:
                        resolved = self.player_map.get(tn_id, tn_id)
                        if resolved and resolved != tn_id:
                            batting_team = resolved
                        # Attempt to resolve bowling team from the other innings
                        if innings_no == 1 and len(innings_list) > 1:
                            bowling_id = innings_list[1].get("tn")
                            if bowling_id:
                                r2 = self.player_map.get(bowling_id, bowling_id)
                                if r2 and r2 != bowling_id:
                                    bowling_team = r2
                        elif innings_no > 1:
                            bowling_id = innings_list[innings_no - 2].get("tn")
                            if bowling_id:
                                r2 = self.player_map.get(bowling_id, bowling_id)
                                if r2 and r2 != bowling_id:
                                    bowling_team = r2

            ball_state = {
                "format": match_format,
                "innings_no": innings_no,
                "over_no": over_no,
                "ball_no": ball_no,
                "batting_team": batting_team,
                "bowling_team": bowling_team,
                "venue": "Live Match Venue",
                "target": target,
                "cumulative_runs": cumulative_runs,
                "cumulative_wkts": cumulative_wkts,
                "legal_balls_bowled": legal_balls_bowled,
                "runs_needed": runs_needed,
                "balls_remaining": balls_remaining,
                "wickets_left": wickets_left,
                "rrr": round(rrr, 2),
                "crr": round(crr, 2),
                "roll6_runs": roll6_runs,
                "roll6_wkts": roll6_wkts,
                "partnership_runs": 0,
                "partnership_wickets": 0,
                "true_runs": 0,
                "is_wicket": 1 if "wicket" in packet.get("flavor", []) else 0,
            }

            # Innings transition handling
            if (
                self.ball_states_history
                and self.ball_states_history[-1]["innings_no"] != innings_no
            ):
                self.ball_states_history = []

            # Avoid duplicates of the same over_ball in sequential history
            if (
                not self.ball_states_history
                or self.ball_states_history[-1]["over_no"] != over_no
                or self.ball_states_history[-1]["ball_no"] != ball_no
            ):
                self.ball_states_history.append(ball_state)
                if len(self.ball_states_history) > 18:
                    self.ball_states_history.pop(0)
            else:
                self.ball_states_history[-1] = ball_state

            if skip_api_call:
                return {}

            payload = self.ball_states_history

            import os

            api_key = os.environ.get("AI_API_KEY")
            if not api_key:
                try:
                    if os.path.exists(".env"):
                        with open(".env", "r") as f:
                            for line in f:
                                if line.strip().startswith("AI_API_KEY="):
                                    api_key = (
                                        line.split("=", 1)[1]
                                        .strip()
                                        .strip('"')
                                        .strip("'")
                                    )
                                    break
                except Exception:
                    pass
            if not api_key:
                api_key = ""

            # print(f"[WinPredictor Debug] [{self.crex_id}] Payload: {payload}")
            hf_url = "https://jathit2645-crinava-v15-api.hf.space/predict"
            headers = {"X-API-Key": api_key}

            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    hf_url, json=payload, headers=headers, timeout=5.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict):
                        data["batting_team"] = batting_team
                        data["bowling_team"] = bowling_team
                        data["innings_no"] = innings_no
                        data["target"] = target
                        data["runs_needed"] = runs_needed
                        data["balls_remaining"] = balls_remaining
                        data["wickets_left"] = wickets_left
                        self.last_win_predictor = dict(data)
                    elif isinstance(data, list) and data and isinstance(data[0], dict):
                        data[0]["batting_team"] = batting_team
                        data[0]["bowling_team"] = bowling_team
                        data[0]["innings_no"] = innings_no
                        data[0]["target"] = target
                        data[0]["runs_needed"] = runs_needed
                        data[0]["balls_remaining"] = balls_remaining
                        data[0]["wickets_left"] = wickets_left
                        self.last_win_predictor = dict(data[0])
                    # print(f"[WinPredictor Debug] [{self.crex_id}] Success: {data}")
                    return data
                print(
                    f"[WinPredictor HTTP Error] {resp.status_code} - {resp.text[:100]}"
                )
        except Exception as e:
            print(f"[WinPredictor Extraction Error] {e}")
        return {}

    # ------------------------------------------------------------------
    # AI COMMENTARY
    # ------------------------------------------------------------------

    async def generate_ai_commentary(self, ball: dict) -> str:
        """Docstring for generate_ai_commentary."""
        raw_comm = ball.get("commentary") or ""

        if not self.ai_api_key:
            return (
                raw_comm
                or f"Over {ball.get('over_ball')}: Score is {ball.get('score')}."
            )

        is_nvidia = "nvapi-" in self.ai_api_key

        bowler_name = "the bowler"
        batsman_name = "the batsman"
        header = raw_comm.split(" - ")[0] if " - " in raw_comm else raw_comm
        m = re.search(
            r"([A-Za-z0-9][A-Za-z0-9\s'\.\-]{1,35})\s+to\s+([A-Za-z0-9][A-Za-z0-9\s'\.\-]{1,35})",
            header,
        )
        if m:
            bowler_name = self.resolve_player_id(m.group(1).strip())
            batsman_name = self.resolve_player_id(m.group(2).strip())

        if "overs" in bowler_name.lower() or len(bowler_name) > 35:
            bowler_name = "the bowler"
        if "overs" in batsman_name.lower() or len(batsman_name) > 35:
            batsman_name = "the batsman"

        if bowler_name == "the bowler" or batsman_name == "the batsman":
            fb, fa = self.get_current_players()
            if bowler_name == "the bowler":
                bowler_name = fb
            if batsman_name == "the batsman":
                batsman_name = fa

        context = self._build_ai_context(ball.get("score") or "")
        avoid_openings = ", ".join(self.recent_ai_openings[-5:]) or "none yet"

        prompt = (
            "You are a legendary cricket commentator and former international cricketer.\n"
            "You read the game like someone who has batted, bowled, captained, and watched pressure up close.\n"
            "Your voice is vivid, technical when useful, and unmistakably human.\n\n"
            f"Bowler: {bowler_name}\n"
            f"Batsman: {batsman_name}\n"
            f"Over: {ball.get('over_ball')}\n"
            f"Score: {ball.get('score')}\n"
            f"Runs on this ball: {ball.get('runs_scored')}\n"
            f"Raw ball note: {raw_comm}\n\n"
            f"Live match context:\n{context}\n\n"
            f"Recent opening phrases to avoid: {avoid_openings}\n\n"
            "Rules:\n"
            f"- {bowler_name} is the bowler and {batsman_name} is the batsman. Do not swap them.\n"
            "- Use only facts present in the raw ball note, score, and runs.\n"
            "- Add cricket intelligence: line, length, field pressure, match rhythm, risk, or batter intent only when supported by the raw note.\n"
            "- Write 2 or 3 polished sentences, maximum 85 words total.\n"
            "- No Markdown, no bullets, no headings, no asterisks, no emojis.\n"
            "- Avoid AI phrases like 'tension is palpable', 'electric atmosphere', 'crucial moment', 'what a moment', 'straightforward delivery'.\n"
            "- Vary the opening. Do not start with the bowler's name every time.\n"
            "- Do not say the batter is 'looking to build' unless the raw note clearly says so.\n"
            "- If the raw note is basic, keep it simple and natural instead of inventing drama.\n\n"
            "Commentary:"
        )

        if is_nvidia:
            url = _NVIDIA_CHAT_URL
            headers = {
                "Authorization": f"Bearer {self.ai_api_key}",
                "Content-Type": _CONTENT_TYPE_JSON,
            }
            payload = {
                "model": _NVIDIA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 256,
            }
        else:
            url = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
            headers = {"Authorization": f"Bearer {self.ai_api_key}"}
            payload = {"inputs": prompt}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, headers=headers, json=payload, timeout=10
                )
                result = response.json()
                if is_nvidia:
                    if "choices" in result:
                        return self._clean_ai_text(
                            result["choices"][0]["message"]["content"]
                        )
                    print(f"[AI Error] NVIDIA response: {result}")
                else:
                    if isinstance(result, list) and result:
                        return self._clean_ai_text(
                            result[0].get("generated_text", "").split("Commentary:")[-1]
                        )
                    print(f"[AI Error] HF response: {result}")
        except Exception as e:
            print(f"[AI Error] [{self.crex_id}]: {e}")

        return f"Ball {ball.get('over_ball')} | {ball.get('runs_scored')} | {raw_comm}"

    async def generate_feed_commentary(
        self,
        raw_text: str,
        item_type: str,
        over_ball: str,
        runs: str,
        score: str,
    ) -> str:
        """Docstring for generate_feed_commentary."""
        if not self.ai_api_key:
            return self._clean_ai_text(raw_text)

        is_nvidia = "nvapi-" in self.ai_api_key
        kind = "ball-by-ball note" if item_type == "b" else "match update"
        context = self._build_ai_context(score)
        avoid_openings = ", ".join(self.recent_ai_openings[-5:]) or "none yet"

        prompt = (
            "You are a legendary cricket commentator and former international cricketer.\n"
            "Rewrite the raw Crex feed line for live viewers with the authority of someone who understands batting plans, bowling spells, field settings, pressure, and momentum.\n\n"
            f"Feed type: {kind}\n"
            f"Over/label: {over_ball}\n"
            f"Runs/marker: {runs}\n"
            f"Current score: {score}\n"
            f"Raw feed line: {raw_text}\n\n"
            f"Live match context:\n{context}\n\n"
            f"Recent opening phrases to avoid: {avoid_openings}\n\n"
            "Rules:\n"
            "- Preserve all facts, names, numbers, quotes, and result details exactly.\n"
            "- Do not invent shots, fielders, injuries, tactics, emotions, or match situation not present in the raw line.\n"
            "- If this is a quote, keep the speaker and meaning intact, but polish the surrounding presentation.\n"
            "- If this is a stat, make it read like a premium broadcast insight.\n"
            "- If this is a ball, add cricket intelligence only when the raw line supports it.\n"
            "- Write 1 to 3 sentences, maximum 90 words.\n"
            "- No Markdown, no bullets, no headings, no asterisks, no emojis.\n"
            "- Avoid generic AI phrases: 'tension is palpable', 'electric atmosphere', 'crucial moment', 'game-changer', 'what a moment'.\n\n"
            "- Vary the first phrase naturally; do not begin every line with the bowler's name.\n"
            "- Keep the pace, length, shot, result, speed and landmark details from Crex when present.\n\n"
            "Refined commentary:"
        )

        if is_nvidia:
            url = _NVIDIA_CHAT_URL
            headers = {
                "Authorization": f"Bearer {self.ai_api_key}",
                "Content-Type": _CONTENT_TYPE_JSON,
            }
            payload = {
                "model": _NVIDIA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.82,
                "max_tokens": 220,
            }
        else:
            url = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
            headers = {"Authorization": f"Bearer {self.ai_api_key}"}
            payload = {"inputs": prompt}

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, headers=headers, json=payload, timeout=10
                )
                result = response.json()
                if is_nvidia:
                    if "choices" in result:
                        return self._clean_ai_text(
                            result["choices"][0]["message"]["content"]
                        )
                    print(f"[AI Error] NVIDIA feed response: {result}")
                else:
                    if isinstance(result, list) and result:
                        return self._clean_ai_text(
                            result[0]
                            .get("generated_text", "")
                            .split("Refined commentary:")[-1]
                        )
                    print(f"[AI Error] HF feed response: {result}")
        except Exception as e:
            print(f"[AI Error] [{self.crex_id}] feed: {e}")

        return self._clean_ai_text(raw_text)

    # ------------------------------------------------------------------
    # STAT CARD AI
    # ------------------------------------------------------------------

    async def process_stat_card(self, raw_stat_text: str, item_id: int) -> None:
        """Docstring for process_stat_card."""
        try:
            ai_stat_text = raw_stat_text
            if self.ai_api_key and "nvapi-" in self.ai_api_key:
                prompt = (
                    "Rewrite this cricket statistic for a live match card.\n\n"
                    f"Raw statistic:\n{raw_stat_text}\n\n"
                    "Rules:\n"
                    "- Preserve every team/player name and every number exactly.\n"
                    "- Write clean plain text only: no Markdown, no bullets, no headings, no asterisks.\n"
                    "- No emojis.\n"
                    "- Keep it to 1 short paragraph, maximum 45 words.\n"
                    "- Sound like a premium cricket broadcast graphic, not an AI assistant.\n\n"
                    "Stat Card:"
                )
                url = _NVIDIA_CHAT_URL
                headers = {
                    "Authorization": f"Bearer {self.ai_api_key}",
                    "Content-Type": _CONTENT_TYPE_JSON,
                }
                payload = {
                    "model": _NVIDIA_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.6,
                    "max_tokens": 150,
                }
                async with httpx.AsyncClient() as client:
                    r = await client.post(
                        url, json=payload, headers=headers, timeout=10.0
                    )
                    if r.status_code == 200:
                        ai_stat_text = self._clean_ai_text(
                            r.json()["choices"][0]["message"]["content"]
                        )

            ai_stat_text = self._clean_ai_text(ai_stat_text)

            packet = {
                "match_id": self.crex_id,
                "event_key": f"stat:{self.crex_id}:{item_id}",
                "score": "",
                "over_ball": "STAT",
                "runs_scored": "STAT",
                "flavor": ["stat"],
                "commentary": ai_stat_text,
                "timestamp": time.time(),
            }
            self._attach_live_context(packet)
            self.logger.log_ball(packet)
            await self.broadcast_to_clients(packet)

        except Exception as e:
            print(f"[Stat AI Error] [{self.crex_id}]: {e}")

    # ------------------------------------------------------------------
    # BROADCAST
    # ------------------------------------------------------------------

    async def broadcast_to_clients(self, packet: dict) -> None:
        """Docstring for broadcast_to_clients."""
        from hub import match_hub

        if self.crex_id not in match_hub:
            match_hub[self.crex_id] = {"history": [], "queues": set()}

        history = match_hub[self.crex_id]["history"]
        event_key = packet.get("event_key")
        if event_key:
            for index, existing in enumerate(history):
                if existing.get("event_key") == event_key:
                    history[index] = packet
                    break
            else:
                history.append(packet)
        elif packet.get("over_ball") != "STAT":
            for index, existing in enumerate(history):
                if existing.get("over_ball") == packet.get("over_ball"):
                    history[index] = packet
                    break
            else:
                history.append(packet)
        else:
            history.append(packet)

        if len(history) > self.max_history_items:
            history.pop(0)

        for queue in match_hub[self.crex_id].get("queues", set()):
            queue.put_nowait(packet)


class HierarchyScraperWorker:
    """NDTV Sports -> Sportzwiki fallback scraper.

    No Cricbuzz.
    """

    def __init__(self, match_data, ai_api_key):
        """Docstring for __init__."""
        self.match = match_data
        self.match_id = match_data["match_id"]
        self.is_running = True
        self.last_ball = None
        self.target_url = None
        self._url_found_logged = False
        self.session = reqs.Session(impersonate="chrome120")

    async def broadcast_to_clients(self, packet: dict) -> None:
        """Docstring for broadcast_to_clients."""
        from hub import match_hub

        if self.match_id not in match_hub:
            match_hub[self.match_id] = {"history": [], "queues": set()}

        history = match_hub[self.match_id]["history"]
        history.append(packet)
        if len(history) > 5:
            history.pop(0)

        for queue in match_hub[self.match_id].get("queues", set()):
            queue.put_nowait(packet)

    async def listen(self) -> None:
        # stealth_session no longer imported locally
        """Docstring for listen."""
        from bs4 import BeautifulSoup

        ALIASES = {"skr": "sk", "jer": "jsy", "sui": "swz", "phi": "phl"}

        while self.is_running:
            try:
                if not self.target_url:
                    cb_teams = self.match.get("teams", [])

                    try:
                        r = await asyncio.to_thread(
                            self.session.request,
                            "GET",
                            "https://sports.ndtv.com/cricket/live-scores",
                            timeout=15,
                        )
                        if r.status_code == 200:
                            soup = BeautifulSoup(r.text, _HTML_PARSER)
                            for a in list(soup.find_all("a", href=True)):
                                href = a["href"].lower()
                                if (
                                    "cricket" in href
                                    and len(cb_teams) > 0
                                    and all(
                                        t in href
                                        or (t in ALIASES and ALIASES[t] in href)
                                        for t in cb_teams
                                    )
                                ):
                                    self.target_url = (
                                        href
                                        if href.startswith("http")
                                        else "https://sports.ndtv.com" + href
                                    )
                                    break
                    except Exception:
                        pass

                    if not self.target_url:
                        try:
                            r2 = await asyncio.to_thread(
                                self.session.request,
                                "GET",
                                "https://sportzwiki.com/live-cricket-score",
                                timeout=15,
                            )
                            if r2.status_code == 200:
                                soup = BeautifulSoup(r2.text, _HTML_PARSER)
                                for a in list(soup.find_all("a", href=True)):
                                    href = a["href"].lower()
                                    if len(cb_teams) > 0 and all(
                                        t in href
                                        or (t in ALIASES and ALIASES[t] in href)
                                        for t in cb_teams
                                    ):
                                        self.target_url = (
                                            href
                                            if href.startswith("http")
                                            else "https://sportzwiki.com" + href
                                        )
                                        break
                        except Exception:
                            pass

                    if not self.target_url and len(cb_teams) == 2:
                        a, b = cb_teams
                        sa = re.sub(r"[^a-z0-9]", "-", a)
                        sb = re.sub(r"[^a-z0-9]", "-", b)
                        self.target_url = (
                            f"https://sports.ndtv.com/cricket/{sa}-vs-{sb}"
                        )

                    if self.target_url and not self._url_found_logged:
                        print(f"[Hierarchy] [{self.match_id}] URL: {self.target_url}")
                        self._url_found_logged = True

                if self.target_url:
                    resp = await asyncio.to_thread(
                        self.session.request, "GET", self.target_url, timeout=15
                    )
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, _HTML_PARSER)
                        for s in list(soup(
                            ["script", "style", "header", "nav", "footer", "aside"]
                        )):
                            s.decompose()
                        for w in list(soup.find_all(
                            class_=re.compile(
                                r"header|nav|ticker|widget|sidebar|menu|banner", re.I
                            )
                        )):
                            w.decompose()

                        score_pat = re.compile(
                            r"\b\d{1,3}[/-]\d{1,2}\b|\b\d{1,3}\s*/\s*\d{1,2}\s*\(\d+\.?\d*\)\b"
                        )
                        score_text = ""

                        for c in soup.find_all(
                            ["div", "span", "h1", "h2"],
                            class_=re.compile(r"score|scr|match|bat|inn|total", re.I),
                        ):
                            txt = c.get_text(separator=" ", strip=True)
                            if score_pat.search(txt) and len(txt) < 60:
                                score_text = txt
                                break

                        if not score_text:
                            for c in list(soup.find_all(["div", "span", "h1", "h2"])):
                                txt = c.get_text(separator=" ", strip=True)
                                if score_pat.search(txt) and len(txt) < 60:
                                    score_text = txt
                                    break

                        if score_text:
                            om = re.search(
                                r"(\d+\.\d+)\s*(?:Ov|overs)", resp.text, re.IGNORECASE
                            )
                            over_text = om.group(1) if om else "Live"
                            ball_key = f"{over_text}_{score_text}"
                            if ball_key != self.last_ball:
                                self.last_ball = ball_key
                                packet = {
                                    "over_ball": over_text,
                                    "runs_scored": "-",
                                    "score": score_text,
                                    "commentary": f"📡 Live: {self.match['title']}",
                                }
                                await self.broadcast_to_clients(packet)

            except Exception as e:
                print(f"[Hierarchy] [{self.match_id}] Error: {e}")

            await asyncio.sleep(20)
