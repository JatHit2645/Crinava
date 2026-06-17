# CRINAVA_TELEMETRY_UPGRADE_REVISION_1
import asyncio
from stealth import stealth_session
from bs4 import BeautifulSoup
import re


class CrinavaDiscovery:
    """Handles Step 1 (Discovery) and Step 2 (Matching) of the 7-step plan."""

    def __init__(self):
        self.live_matches = []
        self.discovery_interval = 300  # 5 minutes
        self.jitter_max = 60  # 1 minute jitter
        self._printed_log_keys = set()
        self._last_log_signatures = {}

    def _print_once(self, key: str, message: str) -> None:
        if key in self._printed_log_keys:
            return
        self._printed_log_keys.add(key)
        print(message)

    def _print_on_change(self, key: str, signature, message: str) -> None:
        if self._last_log_signatures.get(key) == signature:
            return
        self._last_log_signatures[key] = signature
        print(message)

    async def fetch_cricbuzz_schedule(self):
        """Step 1: Siphon matches across all three temporal states from
        Cricbuzz."""
        targets = {
            "Live": "https://www.cricbuzz.com/cricket-match/live-scores",
            "Completed": "https://www.cricbuzz.com/cricket-match/live-scores/recent-matches",
            "Upcoming": "https://www.cricbuzz.com/cricket-match/live-scores/upcoming-matches",
        }

        final_matches = []
        seen_ids = set()

        # Concurrent raw siphoning mapped by state
        results = {"Completed": [], "Upcoming": [], "Live": []}

        async def fetch_and_parse(state, url):
            try:
                self._print_once(
                    f"siphon:{state}:{url}",
                    f"[Discovery] Siphoning {state} from: {url}",
                )
                resp = await asyncio.to_thread(
                    stealth_session.request, "GET", url, timeout=15
                )
                if resp.status_code != 200:
                    return
                pattern1 = r'href="/live-cricket-scores/(\d+)/([^"]+)"'
                pattern2 = r'href="/cricket-scores/(\d+)/([^"]+)"'
                pattern3 = r'href="/cricket-match/(\d+)/([^"]+)"'

                matches = (
                    re.findall(pattern1, resp.text)
                    + re.findall(pattern2, resp.text)
                    + re.findall(pattern3, resp.text)
                )
                for cb_id, slug in matches:
                    results[state].append((cb_id, slug))
            except Exception as e:
                self._print_once(
                    f"discovery-error:{state}:{e}",
                    f"[Error] Discovery failed for {state}: {e}",
                )

        # Fetch all three concurrently for blazing speed
        tasks = [fetch_and_parse(state, url) for state, url in targets.items()]
        await asyncio.gather(*tasks)

        # Ordered Priority insertion: Completed -> Upcoming -> Live
        for state in ["Completed", "Upcoming", "Live"]:
            for cb_id, slug in results[state]:
                if cb_id in seen_ids:
                    continue
                seen_ids.add(cb_id)

                raw_title = slug.replace("-", " ").title()
                teams = []
                if "-vs-" in slug:
                    parts = slug.split("-vs-")
                    teams = [
                        parts[0].split("-")[-1].lower(),
                        parts[1].split("-")[0].lower(),
                    ]

                final_matches.append(
                    {
                        "title": raw_title,
                        "teams": teams,
                        "cricbuzz_id": cb_id,
                        "url": f"https://www.cricbuzz.com/live-cricket-scores/{cb_id}/{slug}",
                        "state": state,
                    }
                )

        count_signature = (
            len(final_matches),
            tuple(
                (state, len(results[state]))
                for state in ["Live", "Completed", "Upcoming"]
            ),
        )
        self._print_on_change(
            "cricbuzz-count",
            count_signature,
            f"[Discovery] Found {len(final_matches)} genuinely live/recent/upcoming matches on Cricbuzz.",
        )
        return final_matches

    async def build_crex_map(self):
        """Official Crex Live Scores & Schedule HTML Siphoner."""
        urls = ["https://crex.com/cricket-live-score", "https://crex.com/schedule"]

        crex_map = {}
        for url in urls:
            try:
                default_state = "Upcoming" if "schedule" in url else "Live"
                self._print_once(
                    f"crex-fetch:{url}",
                    f"[Matching] Fetching match list from Crex URL: {url}",
                )
                response = await asyncio.to_thread(
                    stealth_session.request, "GET", url, timeout=20
                )
                if response.status_code != 200:
                    continue

                # Parse slugs and IDs using regex first to ensure we get everything
                pattern = (
                    r'href="/cricket-live-score/([^/]+-match-updates-([A-Za-z0-9]+))"'
                )
                matches = re.findall(pattern, response.text)
                for slug, mid in matches:
                    if mid not in crex_map:
                        if "-vs-" in slug:
                            parts = slug.split("-vs-")
                            t1_n = parts[0].replace("-", " ").strip().lower()
                            t2_n = parts[1].split("-")[0].strip().lower()
                            display_slug = slug.split("-match-updates-")[0]
                            pretty_title = display_slug.replace("-", " ").title()

                            crex_map[mid] = {
                                "t1_n": t1_n,
                                "t1_sn": t1_n,
                                "t2_n": t2_n,
                                "t2_sn": t2_n,
                                "title": pretty_title,
                                "slug": slug,
                                "state": default_state,  # Start with URL default
                            }

                # Now use soup parser to refine the states precisely
                soup = BeautifulSoup(response.text, "html.parser")
                for link in soup.find_all("a"):
                    href = link.get("href", "")
                    if "cricket-live-score" not in href:
                        continue

                    m_id = re.search(r"-match-updates-([A-Za-z0-9]+)$", href)
                    if not m_id:
                        continue
                    mid = m_id.group(1)

                    if mid in crex_map:
                        # Get ONLY the text within this specific link to prevent cross-contamination from parent containers
                        card_text = link.get_text(separator=" ").lower()

                        # 1. Completed check (highest priority)
                        if any(
                            phrase in card_text
                            for phrase in [
                                "won by",
                                "won the series",
                                "result",
                                "tied",
                                "drawn",
                                "abandoned",
                                "no result",
                                "complete",
                                "won the match",
                            ]
                        ):
                            crex_map[mid]["state"] = "Completed"
                        # 2. Upcoming check (check next to prevent wrong Live tags)
                        elif (
                            "upcoming" in card_text
                            or "tomorrow" in card_text
                            or "yet to begin" in card_text
                            or "starts at" in card_text
                            or "starts in" in card_text
                            or "today" in card_text
                            or bool(
                                re.search(r"\b\d{1,2}:\d{2}\s*(?:am|pm)?\b", card_text)
                            )
                            or bool(re.search(r"\b\d{1,2}\s*(?:am|pm)\b", card_text))
                            or bool(re.search(r"\b(?:am|pm)\b", card_text))
                            or bool(
                                re.search(
                                    r"\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b",
                                    card_text,
                                )
                            )
                        ):
                            crex_map[mid]["state"] = "Upcoming"
                        # 3. Live check
                        elif (
                            "live" in card_text
                            or "stumps" in card_text
                            or "day " in card_text
                            or "opt to" in card_text
                            or "choose to" in card_text
                            or "yet to bat" in card_text
                            or bool(re.search(r"\(\d+\.\d+\)", card_text))
                        ):
                            crex_map[mid]["state"] = "Live"

            except Exception as e:
                self._print_once(
                    f"crex-error:{url}:{e}",
                    f"[Error] Crex DOM siphon failed for {url}: {e}",
                )

        return crex_map

    async def run_discovery_loop(self):
        """The main loop: Crex-Primary Discovery, then Cricbuzz-Hierarchy
        Fallback."""
        while True:
            # 1. Get Primary Matches from Crex
            crex_map = await self.build_crex_map()

            # 2. Get Cricbuzz Matches for Fallback
            cb_matches = await self.fetch_cricbuzz_schedule()

            # Global Alias Engine for Team Codes
            ALIASES = {
                "skr": "sk",
                "sk": "skr",
                "jer": "jsy",
                "jsy": "jer",
                "sui": "swz",
                "swz": "sui",
                "vut": "van",
                "van": "vut",
                "phi": "phl",
                "phl": "phi",
                "yor": "yorks",
                "yorks": "yor",
                "nots": "notts",
                "notts": "nots",
                "warks": "warks",
                "ham": "hants",
                "hants": "ham",
                "lsg": "lucknow",
                "rr": "rajasthan",
                "rcb": "bengaluru",
                "dc": "delhi",
                "mi": "mumbai",
                "csk": "chennai",
                "kkr": "kolkata",
                "srh": "hyderabad",
                "pbks": "punjab",
                "gt": "gujarat",
                "pk": "punjab",
            }

            final_list = []
            used_cb_ids = set()

            # First, add all Crex matches (Primary)
            for crex_id, crex_data in crex_map.items():
                match_item = {
                    "title": crex_data["title"],
                    "teams": [crex_data["t1_n"], crex_data["t2_n"]],
                    "cricbuzz_id": None,
                    "match_id": f"CREX_{crex_id}",
                    "source": "crex",
                    "url": f"https://crex.com/cricket-live-score/{crex_data['slug']}",
                    "state": crex_data["state"],
                }

                # Try to find a matching Cricbuzz match to link the Cricbuzz ID if needed
                for cb in cb_matches:
                    if cb["cricbuzz_id"] in used_cb_ids:
                        continue

                    # Team match check
                    cb_teams = cb.get("teams", [])
                    team_matches = 0

                    valid_crex_terms = {
                        crex_data["t1_n"],
                        crex_data["t1_sn"],
                        crex_data["t2_n"],
                        crex_data["t2_sn"],
                    }
                    extended_crex_terms = set(valid_crex_terms)
                    for term in valid_crex_terms:
                        if term in ALIASES:
                            extended_crex_terms.add(ALIASES[term])

                    def clean_name(val):
                        val = re.sub(r"[^a-z0-9]", "", str(val or "").lower())
                        if val.endswith("women"):
                            val = val[:-5]
                        elif val.endswith("w") and len(val) > 3:
                            val = val[:-1]
                        return val

                    for cb_team in cb_teams:
                        clean_cb = clean_name(cb_team)
                        clean_extended = {clean_name(t) for t in extended_crex_terms}
                        if clean_cb in clean_extended:
                            team_matches += 1
                        else:
                            for term in valid_crex_terms:
                                clean_term = clean_name(term)
                                if (
                                    clean_term
                                    and (
                                        clean_cb in clean_term
                                        or clean_term.startswith(clean_cb)
                                        or clean_cb.startswith(clean_term)
                                    )
                                    and len(clean_cb) >= 3
                                ):
                                    team_matches += 1
                                    break

                    if team_matches >= 2 or (len(cb_teams) == 1 and team_matches == 1):
                        match_item["cricbuzz_id"] = cb["cricbuzz_id"]
                        used_cb_ids.add(cb["cricbuzz_id"])
                        self._print_once(
                            f"linked:{crex_id}:{cb['cricbuzz_id']}",
                            f"[Matching] Primary linked Crex {crex_id} to Cricbuzz {cb['cricbuzz_id']}",
                        )
                        break

                final_list.append(match_item)

            # Second, for any Cricbuzz matches that did NOT match any Crex match, add as Hierarchy
            unmatched_count = 0
            for cb in cb_matches:
                if cb["cricbuzz_id"] not in used_cb_ids:
                    final_list.append(
                        {
                            "title": cb["title"],
                            "teams": cb.get("teams", []),
                            "cricbuzz_id": cb["cricbuzz_id"],
                            "match_id": f"NDTV_{cb['cricbuzz_id']}",
                            "source": "hierarchy",
                            "url": cb["url"],
                            "state": cb.get("state", "Live"),
                        }
                    )
                    unmatched_count += 1

            if unmatched_count > 0:
                hierarchy_signature = tuple(
                    sorted(
                        m["match_id"]
                        for m in final_list
                        if m.get("source") == "hierarchy"
                    )
                )
                self._print_on_change(
                    "hierarchy-routes",
                    hierarchy_signature,
                    f"[Hierarchy] Routed {unmatched_count} unmatched Cricbuzz matches to NDTV/Sportzwiki Fallback",
                )

            self.live_matches = final_list
            cycle_signature = tuple(
                sorted((m.get("match_id"), m.get("state")) for m in final_list)
            )
            self._print_on_change(
                "cycle-summary",
                cycle_signature,
                f"[Discovery] Cycle complete. Primary Crex: {len(crex_map)}, Fallback Hierarchy: {len(final_list) - len(crex_map)}",
            )
            await asyncio.sleep(60)


# Initialize engine
discovery_engine = CrinavaDiscovery()
