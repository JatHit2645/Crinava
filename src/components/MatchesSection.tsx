// CRINAVA_TELEMETRY_UPGRADE_REVISION_1
import React, { useState, useEffect } from "react";
import {
  Trophy,
  MapPin,
  ArrowLeft,
  Loader2,
  ChevronRight,
  Star,
  Info,
  Activity,
  Search,
  SlidersHorizontal,
  Zap,
  Gavel,
  BookOpen,
  Users,
  TrendingUp,
} from "lucide-react";
import { VerdictTool } from "./VerdictTool";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import { TurningPointHeatmap } from "./TurningPointHeatmap";
import { MirrorMatch } from "./MirrorMatch";
import { PlayerImpactRadar } from "./PlayerImpactRadar";
import { MomentumMap } from "./MomentumMap";
import { BallByBallImpact } from "./BallByBallImpact";

interface Tournament {
  event_name: string;
  season: string;
  start_date?: string;
  end_date?: string;
  match_count?: number;
  match_type?: string;
  gender?: string;
}

interface MatchData {
  [key: string]: any;
  match_id: number;
  season?: string;
  match_date?: string;
  team_1?: string;
  team_2?: string;
  event_name?: string;
  match_type?: string;
  city?: string;
  venue?: string;
  toss_winner_id?: string;
  toss_decision?: string;
  outcome_result?: string;
  outcome_winner_id?: string;
  victory_margin?: number;
  player_of_match?: string;
  raw_info?: any;
  outcome?: any;
}

// --- Helper to parse Cricsheet JSON into a readable scorecard ---
/**
* Parses match innings data and returns structured team batting, bowling, extras, and dismissal summaries.
* @example
* parseMatchInfo(rawInfo)
* [{
*   team: "Team A",
*   totalRuns: 150,
*   totalWickets: 8,
*   overs: "20.0",
*   batters: [],
*   bowlers: [],
*   extras: { b: 0, lb: 0, w: 0, nb: 0, p: 0, total: 0 },
*   didNotBat: []
* }]
* @param {any} rawInfo - Raw match info object or JSON string containing innings data.
* @returns {Array} Array of innings summaries for each team.
**/
const parseScorecard = (rawInfo: any) => {
  if (typeof rawInfo === "string") {
    try {
      rawInfo = JSON.parse(rawInfo);
    } catch (e) {
      return [];
    }
  }
  if (!rawInfo || !rawInfo.innings) return [];

  const players = rawInfo.info?.players || {};

  let inningsList = [];
  if (Array.isArray(rawInfo.innings)) {
    inningsList = rawInfo.innings;
  } else {
    inningsList = Object.values(rawInfo.innings).map(
      (inn: any) => Object.values(inn)[0],
    );
  }

  return inningsList?.map((inning: any) => {
    const team = inning.team || "Unknown Team";
    const batters: Record<string, any> = {};
    const bowlers: Record<string, any> = {};
    const battersOrder: string[] = [];
    const bowlersOrder: string[] = [];
    let totalRuns = 0;
    let totalWickets = 0;
    let totalLegalBalls = 0;
    const extras = { b: 0, lb: 0, w: 0, nb: 0, p: 0, total: 0 };

    const deliveries: any[] = [];
    if (inning.overs) {
      inning.overs.forEach((over: any) => {
        if (over.deliveries) deliveries.push(...over.deliveries);
      });
    } else if (inning.deliveries) {
      inning.deliveries.forEach((dObj: any) => {
        const [key] = Object.keys(dObj);
        deliveries.push(dObj[key]);
      });
    }

    deliveries.forEach((d: any) => {
      // Batting
      const batter = d.batter || d.batsman;
      const nonStriker = d.non_striker;

      if (!battersOrder.includes(batter)) battersOrder.push(batter);
      if (nonStriker && !battersOrder.includes(nonStriker))
        battersOrder.push(nonStriker);

      if (!batters[batter])
        batters[batter] = {
          name: batter,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          dismissal: "not out",
          sr: "0.00",
        };

      const runsBatter = d.runs ? d.runs.batter || d.runs.batsman || 0 : 0;
      batters[batter].runs += runsBatter;

      const isWide = d.extras && d.extras.wides;
      if (!isWide) batters[batter].balls += 1;
      if (runsBatter === 4) batters[batter].fours += 1;
      if (runsBatter === 6) batters[batter].sixes += 1;

      if (batters[batter].balls > 0) {
        batters[batter].sr = (
          (batters[batter].runs / batters[batter].balls) *
          100
        ).toFixed(2);
      }

      // Bowling
      const bowler = d.bowler;
      if (!bowlersOrder.includes(bowler)) bowlersOrder.push(bowler);

      if (!bowlers[bowler])
        bowlers[bowler] = {
          name: bowler,
          balls: 0,
          runs: 0,
          wickets: 0,
          dots: 0,
          econ: "0.00",
        };

      let isLegalBall = true;
      let bowlerRuns = runsBatter;

      if (d.extras) {
        if (d.extras.wides) {
          isLegalBall = false;
          bowlerRuns += d.extras.wides;
          extras.w += d.extras.wides;
          extras.total += d.extras.wides;
        }
        if (d.extras.noballs) {
          isLegalBall = false;
          bowlerRuns += d.extras.noballs;
          extras.nb += d.extras.noballs;
          extras.total += d.extras.noballs;
        }
        if (d.extras.byes) {
          extras.b += d.extras.byes;
          extras.total += d.extras.byes;
        }
        if (d.extras.legbyes) {
          extras.lb += d.extras.legbyes;
          extras.total += d.extras.legbyes;
        }
        if (d.extras.penalty) {
          extras.p += d.extras.penalty;
          extras.total += d.extras.penalty;
        }
      }

      if (isLegalBall) {
        bowlers[bowler].balls += 1;
        totalLegalBalls += 1;
      }
      if (runsBatter === 0 && !d.extras) {
        bowlers[bowler].dots += 1;
      }
      bowlers[bowler].runs += bowlerRuns;

      if (bowlers[bowler].balls > 0) {
        const oversBowled = bowlers[bowler].balls / 6;
        bowlers[bowler].econ = (bowlers[bowler].runs / oversBowled).toFixed(2);
      }

      totalRuns += d.runs ? d.runs.total || 0 : 0;

      // Wickets
      if (d.wickets) {
        d.wickets.forEach((w: any) => {
          totalWickets += 1;
          const playerOut = w.player_out;
          if (batters[playerOut]) {
            let dismissal = w.kind;
            if (w.kind === "bowled") dismissal = `b ${bowler}`;
            else if (w.kind === "caught")
              dismissal = `c ${w.fielders ? w.fielders?.map((f: any) => f.name).join(", ") : "sub"} b ${bowler}`;
            else if (w.kind === "lbw") dismissal = `lbw b ${bowler}`;
            else if (w.kind === "run out") dismissal = `run out`;
            else if (w.kind === "stumped")
              dismissal = `st ${w.fielders ? w.fielders?.map((f: any) => f.name).join(", ") : "sub"} b ${bowler}`;
            else if (w.kind === "caught and bowled")
              dismissal = `c & b ${bowler}`;
            batters[playerOut].dismissal = dismissal;
          }
          if (
            [
              "bowled",
              "caught",
              "lbw",
              "stumped",
              "caught and bowled",
              "hit wicket",
            ].includes(w.kind)
          ) {
            bowlers[bowler].wickets += 1;
          }
        });
      }
    });

    const teamPlayers = players[team] || [];
    const battedPlayers = Object.keys(batters);
    const didNotBat = teamPlayers.filter(
      (p: string) => !battedPlayers.includes(p),
    );

    return {
      team,
      totalRuns,
      totalWickets,
      overs: `${Math.floor(totalLegalBalls / 6)}.${totalLegalBalls % 6}`,
      batters: battersOrder.map((name) => batters[name]).filter(Boolean),
      bowlers: bowlersOrder.map((name) => bowlers[name]).filter(Boolean),
      extras,
      didNotBat,
    };
  });
};

// --- Helper to calculate Match MVP from reconstructed scorecard ---
/**
 * Calculates and ranks players by total impact score from match scorecard innings data.
 * @example
 * scorecard([{ batters: [{ name: "Player A", runs: 30, sixes: 2, balls: 20 }], bowlers: [{ name: "Player B", wickets: 2, dots: 10, runs: 24 }] }])
 * [{ player_name: "Player A", total_impact_score: 33 }, { player_name: "Player B", total_impact_score: 45 }]
 * @param {any[]} scorecard - Array of inning objects containing batter and bowler statistics.
 * @returns {Array<{ player_name: string, total_impact_score: number }>} Sorted array of players with their computed impact scores in descending order.
 **/
const calculateFallbackMvp = (scorecard: any[]) => {
  const players: Record<string, any> = {};
  scorecard.forEach((inning) => {
    inning.batters?.forEach((b: any) => {
      if (!players[b.name])
        players[b.name] = { player_name: b.name, total_impact_score: 0 };
      players[b.name].total_impact_score +=
        (b.runs || 0) * 1 + (b.sixes || 0) * 2 - (b.balls || 0) * 0.1;
    });
    inning.bowlers?.forEach((b: any) => {
      if (!players[b.name])
        players[b.name] = { player_name: b.name, total_impact_score: 0 };
      players[b.name].total_impact_score +=
        (b.wickets || 0) * 25 + (b.dots || 0) * 1 - (b.runs || 0) * 0.5;
    });
  });
  return Object.values(players).sort(
    (a, b) => b.total_impact_score - a.total_impact_score,
  );
};

/**
 * Displays a searchable, sortable, and filterable list of tournament series and calls a selection handler when a series is clicked.
 * @example
 * MatchesSection({ onSelect: (tournament) => console.log(tournament) })
 * <Tournament /> selection list rendered with filters applied
 * @param {{ onSelect: (tournament: Tournament) => void }} props - Component props containing the callback invoked when a tournament series is selected.
 * @returns {JSX.Element} The rendered tournaments and series section UI.
 **/
const TournamentsList: React.FC<{ onSelect: (t: Tournament) => void }> = ({
  onSelect,
}) => {
  const [allSeries, setAllSeries] = useState<Tournament[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "name_asc" | "name_desc"
  >("newest");
  const [leaguesOnly, setLeaguesOnly] = useState(false);
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">(
    "all",
  );
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [yearRange, setYearRange] = useState<[number, number]>([2000, 2026]);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch all series once on mount
  useEffect(() => {
    /**
     * Fetches series data from the API, updates loading and error state, and stores the results.
     * @example
     * sync()
     * undefined
     * @returns {Promise<void>} Resolves when the series data has been fetched and state has been updated.
     */
    const fetchAllSeries = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/series");
        if (!response.ok)
          throw new Error("Failed to fetch series from CockroachDB");
        const allData = await response.json();

        console.log(
          `Successfully loaded ${allData.length} series via CockroachDB.`,
        );
        setAllSeries(allData);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(
          `Failed to load data: ${err.message || "Unknown error"}. Please check your connection.`,
        );
      }

      setLoading(false);
    };

    fetchAllSeries();
  }, []);

  // Filter and sort client-side
  useEffect(() => {
    /**
     * Filters and sorts tournament series based on search, league, gender, format, and year range criteria, then updates the displayed list.
     * @example
     * applyTournamentFiltersAndSort()
     * undefined
     * @param {Tournament[]} allSeries - List of tournament series to filter and sort.
     * @param {string} searchQuery - Search text used to match tournament event names.
     * @param {boolean} leaguesOnly - Whether to restrict results to league-style tournaments.
     * @param {"all"|"female"|"male"} genderFilter - Gender filter to apply to tournament names.
     * @param {string} formatFilter - Match format filter to apply.
     * @param {[number, number]} yearRange - Inclusive year range used to keep tournaments within bounds.
     * @param {"newest"|"oldest"|"name_asc"|"name_desc"} sortBy - Sorting mode for the filtered tournaments.
     * @returns {void} Does not return a value; updates the tournaments state with the filtered and sorted results.
     **/
    const filterAndSort = () => {
      /**
      * Determines a tournament date string by extracting and comparing year values from tournament data.
      * @example
      * getTournamentDate(t)
      * "2024-12-31"
      * @param {Tournament} t - Tournament object containing event name, season, and optional start date.
      * @returns {string} A resolved date string based on the latest year found, the start date, or a fallback date.
      **/
      const getSortDate = (t: Tournament) => {
        const years: number[] = [];
        const allText = `${t.event_name} ${t.season} ${t.start_date || ""}`;
        const yearMatches = allText.match(/\b(19|20)\d{2}\b/g);
        if (yearMatches) yearMatches.forEach((y) => years.push(parseInt(y, 10)));

        if (t.start_date) {
          const d = new Date(t.start_date);
          if (!isNaN(d.getTime())) years.push(d.getFullYear());
        }

        if (years.length > 0) {
          const maxYear = Math.max(...years);
          if (
            t.start_date &&
            new Date(t.start_date).getFullYear() === maxYear
          ) {
            return t.start_date;
          }
          return `${maxYear}-12-31`;
        }
        return "1900-01-01";
      };

      const getSortName = (t: Tournament) => (t.event_name || "").toLowerCase();

      let filtered = [...allSeries];

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((t) =>
          t.event_name.toLowerCase().includes(q),
        );
      }
      if (leaguesOnly) {
        const leagueKeywords = [
          "League",
          "IPL",
          "BBL",
          "PSL",
          "WPL",
          "SA20",
          "CPL",
          "BPL",
          "World Cup",
        ];
        filtered = filtered.filter((t) =>
          leagueKeywords.some((k) =>
            t.event_name.toLowerCase().includes(k.toLowerCase()),
          ),
        );
      }
      if (genderFilter !== "all") {
        if (genderFilter === "female") {
          filtered = filtered.filter((t) =>
            t.event_name.toLowerCase().includes("women"),
          );
        } else if (genderFilter === "male") {
          filtered = filtered.filter(
            (t) => !t.event_name.toLowerCase().includes("women"),
          );
        }
      }
      if (formatFilter !== "all") {
        if (formatFilter === "IPL") {
          filtered = filtered.filter(
            (t) =>
              t.event_name.toLowerCase().includes("ipl") ||
              t.event_name.toLowerCase().includes("indian premier league"),
          );
        } else if (formatFilter === "BBL") {
          filtered = filtered.filter(
            (t) =>
              t.event_name.toLowerCase().includes("bbl") ||
              t.event_name.toLowerCase().includes("big bash"),
          );
        } else {
          filtered = filtered.filter(
            (t) =>
              t.event_name.toUpperCase().includes(formatFilter.toUpperCase()) ||
              (t.match_type &&
                t.match_type.toUpperCase() === formatFilter.toUpperCase()),
          );
        }
      }
      filtered = filtered.filter((t) => {
        let year = NaN;
        const yearMatch = (t.start_date || t.season || "")
          .toString()
          .match(/\b(19|20)\d{2}\b/);
        if (yearMatch) year = parseInt(yearMatch[0], 10);
        if (isNaN(year)) return true;
        return year >= yearRange[0] && year <= yearRange[1];
      });

      // Apply sorting
      if (sortBy === "newest") {
        filtered.sort((a, b) => {
          const dateA = getSortDate(a);
          const dateB = getSortDate(b);
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return getSortName(a).localeCompare(getSortName(b));
        });
      } else if (sortBy === "oldest") {
        filtered.sort((a, b) => {
          const dateA = getSortDate(a);
          const dateB = getSortDate(b);
          if (dateA !== dateB) return dateA.localeCompare(dateB);
          return getSortName(a).localeCompare(getSortName(b));
        });
      } else if (sortBy === "name_asc") {
        filtered.sort((a, b) => getSortName(a).localeCompare(getSortName(b)));
      } else if (sortBy === "name_desc") {
        filtered.sort((a, b) => getSortName(b).localeCompare(getSortName(a)));
      }

      setTournaments(filtered);
    };

    filterAndSort();
  }, [
    allSeries,
    searchQuery,
    sortBy,
    leaguesOnly,
    genderFilter,
    formatFilter,
    yearRange,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <div className="flex flex-col space-y-4 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-black italic text-white">
            Tournaments & Series
          </h2>
          <span className="text-[10px] font-black text-metallic-gold uppercase tracking-widest bg-metallic-gold/10 px-3 py-1 rounded-full border border-metallic-gold/20 min-w-[100px] h-8 flex items-center justify-center text-center">
            {tournaments.length} Series
          </span>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1 group">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-metallic-gold transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="Search series..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-metallic-gold/50 transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-xl border transition-all ${showFilters ? "bg-metallic-gold/20 border-metallic-gold text-metallic-gold" : "bg-[#111111] border-white/10 text-gray-400 hover:border-white/20"}`}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-[#111111] border border-white/10 rounded-2xl space-y-6">
                {/* Sort Dropdown */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Sort By
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "newest", label: "Newest First" },
                      { id: "oldest", label: "Oldest First" },
                      { id: "name_asc", label: "Name (A-Z)" },
                      { id: "name_desc", label: "Name (Z-A)" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setSortBy(option.id as any)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center text-center ${sortBy === option.id ? "bg-metallic-gold/10 border-metallic-gold text-metallic-gold" : "bg-white/5 border-white/5 text-gray-400 hover:border-white/10"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leagues Toggle */}
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-white">
                      Major Leagues Only
                    </div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest">
                      IPL, BBL, Leagues
                    </div>
                  </div>
                  <button
                    onClick={() => setLeaguesOnly(!leaguesOnly)}
                    className={`w-10 h-5 rounded-full relative transition-all ${leaguesOnly ? "bg-metallic-gold" : "bg-gray-700"}`}
                  >
                    <div
                      className={`absolute top-1 size-3 rounded-full transition-all ${leaguesOnly ? "left-6 bg-black" : "left-1 bg-white"}`}
                    />
                  </button>
                </div>

                {/* Gender Filter */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Gender
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "all", label: "All" },
                      { id: "male", label: "Men's" },
                      { id: "female", label: "Women's" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setGenderFilter(option.id as any)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center text-center ${genderFilter === option.id ? "bg-metallic-gold/10 border-metallic-gold text-metallic-gold" : "bg-white/5 border-white/5 text-gray-400 hover:border-white/10"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format Filter */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Format / League
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "all", label: "All" },
                      { id: "T20", label: "T20I" },
                      { id: "ODI", label: "ODI" },
                      { id: "MDM", label: "Test" },
                      { id: "IPL", label: "IPL" },
                      { id: "BBL", label: "BBL" },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setFormatFilter(option.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center text-center ${formatFilter === option.id ? "bg-metallic-gold/10 border-metallic-gold text-metallic-gold" : "bg-white/5 border-white/5 text-gray-400 hover:border-white/10"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Year Range Slider */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Year Range
                    </label>
                    <span className="text-xs font-bold text-metallic-gold">
                      {yearRange[0]} - {yearRange[1]}
                    </span>
                  </div>
                  <div className="px-2">
                    <div className="relative h-2 bg-white/5 rounded-full flex items-center">
                      <div
                        className="absolute h-full bg-metallic-gold/50 rounded-full"
                        style={{
                          left: `${((yearRange[0] - 2000) / (2026 - 2000)) * 100}%`,
                          width: `${((yearRange[1] - yearRange[0]) / (2026 - 2000)) * 100}%`,
                        }}
                      />
                      <input
                        type="range"
                        min="2000"
                        max="2026"
                        value={yearRange[0]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setYearRange([
                            Math.min(val, yearRange[1]),
                            yearRange[1],
                          ]);
                        }}
                        className="absolute w-full h-2 bg-transparent appearance-none pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-metallic-gold [&::-webkit-slider-thumb]:rounded-full"
                      />
                      <input
                        type="range"
                        min="2000"
                        max="2026"
                        value={yearRange[1]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setYearRange([
                            yearRange[0],
                            Math.max(val, yearRange[0]),
                          ]);
                        }}
                        className="absolute w-full h-2 bg-transparent appearance-none pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-metallic-gold [&::-webkit-slider-thumb]:rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="relative">
            <Loader2 className="animate-spin text-metallic-gold" size={48} />
          </div>
          <div className="text-center space-y-2">
            <p className="text-white font-black uppercase tracking-[0.2em]">
              Synchronizing Database
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">
              Loading series...
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tournaments?.map((t, idx) => (
            <div
              key={idx}
              onClick={() => onSelect(t)}
              className="p-6 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl cursor-pointer hover:border-metallic-gold/50 transition-all group flex justify-between items-center"
            >
              <div>
                <h3 className="text-xl font-black text-white group-hover:text-metallic-gold transition-colors">
                  {t.event_name}
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm text-metallic-gold">{t.season}</p>
                  {t.match_count && (
                    <span className="text-[10px] font-black text-metallic-gold/60 uppercase tracking-widest px-2 py-0.5 bg-metallic-gold/5 rounded border border-metallic-gold/10">
                      {t.match_count} Matches
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="text-gray-600 group-hover:text-metallic-gold transition-colors" />
            </div>
          ))}
          {tournaments.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="p-4 bg-white/5 rounded-full w-fit mx-auto">
                {error ? (
                  <div className="text-red-500 font-black text-2xl">!</div>
                ) : (
                  <Search size={32} className="text-gray-600" />
                )}
              </div>
              <div className="space-y-1">
                {error ? (
                  <div className="space-y-2">
                    <p className="text-red-500 font-bold">
                      Failed to load series
                    </p>
                    <p className="text-xs text-gray-500 max-w-md mx-auto">
                      {error}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-500 italic">
                      No series found matching your filters.
                    </p>
                    {allSeries.length > 0 && (
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                        Found {allSeries.length} series total, but filters are
                        hiding them.
                      </p>
                    )}
                    {allSeries.length === 0 && (
                      <p className="text-[10px] text-red-500/50 uppercase tracking-widest">
                        Database returned 0 matches. Please check connection.
                      </p>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setLeaguesOnly(false);
                  setGenderFilter("all");
                  setFormatFilter("all");
                  setYearRange([2000, 2026]);
                  // If there was an error, this will trigger the useEffect to retry
                  console.log("RELOAD BLOCKED");
                }}
                className="text-metallic-gold text-xs font-black uppercase tracking-widest hover:underline px-6 py-2 bg-metallic-gold/5 rounded-full border border-metallic-gold/20"
              >
                {error ? "Retry Loading" : "Reset All Filters"}
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

const TournamentMatchesList: React.FC<{
  tournament: Tournament;
  onBack: () => void;
  onSelectMatch: (id: number) => void;
/**
* Renders a tournament matches dashboard with tabs for matches, stats, verdicts, AI insights, and tournament leaders.
* @example
* MatchesSection({ tournament, onBack, onSelectMatch })
* <MatchesSection />
* @param {{object}} tournament - Tournament details including event name and season used to fetch and display data.
* @param {{function}} onBack - Callback invoked to navigate back from the current view.
* @param {{function}} onSelectMatch - Callback invoked when a match is selected from the matches list.
* @returns {{JSX.Element}} A React component that displays tournament matches, statistics, verdicts, and generated insights.
**/
}> = ({ tournament, onBack, onSelectMatch }) => {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    | "matches"
    | "predict"
    | "verdict"
    | "analytics"
    | "playingXI"
    | "stories"
    | "stats"
  >("matches");
  const [activeStatTab, setActiveStatTab] = useState<
    | "runs"
    | "wickets"
    | "sr"
    | "avg"
    | "econ"
    | "mvp"
    | "highestScore"
    | "centuries"
    | "fours"
    | "sixes"
    | "fiveWicketHauls"
    | "bowlingAvg"
    | "bowlingSR"
  >("mvp");
  const [aiContent, setAiContent] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    /**
    * Fetches matches for the current tournament, maps the response into match data, and updates loading state.
    * @example
    * sync()
    * undefined
    * @returns {Promise<void>} Resolves when matches are fetched and state is updated.
    **/
    const fetchMatches = async () => {
      setLoading(true);
      try {
        console.log(
          `📡 Fetching matches for: ${tournament.event_name} (${tournament.season})`,
        );
        const url = `/api/series/matches?eventName=${encodeURIComponent(tournament.event_name)}&season=${encodeURIComponent(tournament.season || "")}`;
        const response = await fetch(url);
        if (!response.ok)
          throw new Error("Failed to fetch matches from CockroachDB");
        const data = await response.json();

        console.log(`✅ Received ${data.length} matches from Engine.`);

        // Map CockroachDB fields to MatchData interface if necessary
        const mappedData = data.map((m: any) => ({
          match_id: m.match_id,
          match_date: m.match_date,
          venue: m.venue_name || m.venue,
          city: m.city,
          match_type: m.match_type,
          team_1: "Team 1",
          team_2: "Team 2",
        }));

        setMatches(mappedData);
      } catch (err: any) {
        console.error("❌ Matches list error:", err);
        setMatches([]);
      }
      setLoading(false);
    };
    fetchMatches();
  }, [tournament]);

  // Lazy load stats only when the stats tab is active
  useEffect(() => {
    if (activeTab === "stats" && !stats && matches.length > 0) {
      /**
       * Sets the stats loading state, logs a server-side stats request, and initializes stats with empty arrays.
       * @example
       * sync()
       * undefined
       * @param {void} undefined - This function does not accept any arguments.
       * @returns {void} This function does not return a value.
       */
      const fetchStats = async () => {
        setStatsLoading(true);
        try {
          // Placeholder for the Engine Stats logic (Calculated on the server)
          console.log(
            "Stats tab requested for historical matches via Crinava Engine.",
          );
          // We set stats to empty for now to avoid the UI hanging
          setStats({
            runs: [],
            wickets: [],
            highestScore: [],
            mostCenturies: [],
            mostFours: [],
            mostSixes: [],
            most5WicketHauls: [],
            bowlingAvg: [],
            bowlingSR: [],
            highestSR: [],
            highestAvg: [],
            bestEcon: [],
            mvp: [],
          });
        } catch (err) {
          console.error("Stats fetch error:", err);
        } finally {
          setStatsLoading(false);
        }
      };
      fetchStats();
    }
  }, [activeTab, matches, stats]);

  useEffect(() => {
    if (
      ["predict", "playingXI", "stories"].includes(activeTab) &&
      !aiContent[activeTab]
    ) {
      /**
       * Generates AI-powered tournament insights for the currently active tab and stores the result in state.
       * @example
       * sync()
       * "Predict the outcome and key trends for the tournament..."
       * @returns {Promise<void>} Resolves when the AI content has been fetched and state has been updated.
       */
      const fetchAiContent = async () => {
        setAiLoading(true);
        try {
          const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
if (!apiKey) {
  console.warn("WARNING: VITE_GEMINI_API_KEY is missing. AI features will be disabled.");
}
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : {
  models: {
    generateContent: async () => ({ text: "AI functionality disabled due to missing API key." })
  }
} as any;
          const model = "gemini-3-flash-preview";

          let prompt = "";
          if (activeTab === "predict")
            prompt = `Predict the outcome and key trends for the tournament: ${tournament.event_name} ${tournament.season}. Who are the favorites and why?`;
          if (activeTab === "playingXI")
            prompt = `Select the Best XI of the tournament for ${tournament.event_name} ${tournament.season} based on performance.`;
          if (activeTab === "stories")
            prompt = `Tell 3 compelling human-interest stories or player trajectories from the ${tournament.event_name} ${tournament.season}.`;

          const response = await genAI.models.generateContent({
            model,
            contents: prompt,
          });

          setAiContent((prev) => ({
            ...prev,
            [activeTab]: response.text || "No content generated.",
          }));
        } catch (err) {
          console.error("AI fetch error:", err);
          setAiContent((prev) => ({
            ...prev,
            [activeTab]: "Failed to generate AI insights. Please try again.",
          }));
        }
        setAiLoading(false);
      };
      fetchAiContent();
    }
  }, [activeTab, tournament]);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-metallic-gold" size={32} />
      </div>
    );

  /**
   * Renders a ranked list of match items with an optional value formatter.
   * @example
   * renderMatchList(list, valueKey, formatFn)
   * <div>...</div>
   * @param {any[]} list - Array of items to display in the list.
   * @param {string} valueKey - Key used to read the displayed value from each item.
   * @param {(p: any) => string | number} [formatFn] - Optional formatter applied to each item value before rendering.
   * @returns {JSX.Element} A JSX element containing the formatted list or a fallback message when the list is empty.
   **/
  const renderStatList = (
    list: any[],
    valueKey: string,
    formatFn?: (p: any) => string | number,
  ) => (
    <div className="space-y-2 mt-4">
      {list?.map((p, i) => (
        <div
          key={i}
          className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-gray-500 font-bold w-4 shrink-0">
              {i + 1}
            </span>
            <span className="text-white font-medium truncate pr-2">
              {p.name}
            </span>
          </div>
          <span className="font-black text-metallic-gold shrink-0">
            {formatFn ? formatFn(p) : p[valueKey]}
          </span>
        </div>
      ))}
      {list?.length === 0 && (
        <div className="text-gray-500 text-sm text-center py-4">
          Not enough data
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black italic text-white">
            {tournament.event_name}
          </h2>
          <p className="text-metallic-gold">{tournament.season}</p>
        </div>
        <span className="text-sm text-gray-400 font-bold">
          {matches.length} Matches
        </span>
      </div>

      <div className="overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10 min-w-max">
          {[
            { id: "matches", label: "Matches" },
            { id: "stats", label: "Stats" },
            { id: "verdict", label: "Verdict" },
            { id: "playingXI", label: "Playing XI" },
            { id: "stories", label: "Stories" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? "bg-aurora-teal text-black shadow-[0_0_20px_rgba(0,255,159,0.3)]" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tournament Stats Section */}
      {activeTab === "stats" && (
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-5 shadow-2xl">
          <h3 className="text-lg font-black italic text-white mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-metallic-gold" /> Tournament
            Leaders
          </h3>

          {statsLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="animate-spin text-metallic-gold" size={32} />
              <p className="text-gray-500 text-xs font-black uppercase tracking-widest animate-pulse">
                Calculating tournament statistics...
              </p>
            </div>
          ) : stats ? (
            <>
              <div className="flex overflow-x-auto pb-4 gap-2 scrollbar-hide">
                {[
                  { id: "mvp", label: "Crinava MVP" },
                  { id: "runs", label: "Most Runs" },
                  { id: "wickets", label: "Most Wickets" },
                  { id: "highestScore", label: "Highest Score" },
                  { id: "centuries", label: "Most Centuries" },
                  { id: "fours", label: "Most Fours" },
                  { id: "sixes", label: "Most Sixes" },
                  { id: "fiveWicketHauls", label: "Most 5-Wicket Hauls" },
                  { id: "bowlingAvg", label: "Bowling Average" },
                  { id: "bowlingSR", label: "Bowling Strike Rate" },
                  { id: "sr", label: "Highest SR" },
                  { id: "avg", label: "Highest Avg" },
                  { id: "econ", label: "Best Econ" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveStatTab(tab.id as any)}
                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${activeStatTab === tab.id ? "bg-metallic-gold text-black" : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mt-2">
                {activeStatTab === "mvp" &&
                  renderStatList(stats.mvp, "impact", (p) =>
                    p.impact.toFixed(1),
                  )}
                {activeStatTab === "runs" && renderStatList(stats.runs, "runs")}
                {activeStatTab === "wickets" &&
                  renderStatList(stats.wickets, "wickets")}
                {activeStatTab === "highestScore" &&
                  renderStatList(stats.highestScore, "highestScore")}
                {activeStatTab === "centuries" &&
                  renderStatList(stats.mostCenturies, "centuries")}
                {activeStatTab === "fours" &&
                  renderStatList(stats.mostFours, "fours")}
                {activeStatTab === "sixes" &&
                  renderStatList(stats.mostSixes, "sixes")}
                {activeStatTab === "fiveWicketHauls" &&
                  renderStatList(stats.most5WicketHauls, "fiveWicketHauls")}
                {activeStatTab === "bowlingAvg" &&
                  renderStatList(stats.bowlingAvg, "bowlRuns", (p) =>
                    (p.bowlRuns / p.wickets).toFixed(1),
                  )}
                {activeStatTab === "bowlingSR" &&
                  renderStatList(stats.bowlingSR, "bowlBalls", (p) =>
                    (p.bowlBalls / p.wickets).toFixed(1),
                  )}
                {activeStatTab === "sr" &&
                  renderStatList(stats.highestSR, "runs", (p) =>
                    ((p.runs / p.balls) * 100).toFixed(1),
                  )}
                {activeStatTab === "avg" &&
                  renderStatList(stats.highestAvg, "runs", (p) =>
                    p.dismissals === 0
                      ? p.runs.toFixed(1)
                      : (p.runs / p.dismissals).toFixed(1),
                  )}
                {activeStatTab === "econ" &&
                  renderStatList(stats.bestEcon, "bowlRuns", (p) =>
                    ((p.bowlRuns / p.bowlBalls) * 6).toFixed(1),
                  )}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-10 italic">
              Select the Stats tab to calculate tournament leaders.
            </div>
          )}
        </div>
      )}

      {activeTab === "matches" && (
        <div className="space-y-4">
          <h3 className="text-lg font-black italic text-white mb-2">Matches</h3>
          {matches?.map((match) => (
            <div
              key={match.match_id}
              onClick={() => onSelectMatch(match.match_id)}
              className="p-4 bg-[#111111] border border-white/10 rounded-xl shadow-lg cursor-pointer hover:border-metallic-gold/30 transition-all"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-gray-500">
                  {match.match_date}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin size={12} /> {match.venue}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-lg border border-white/5">
                <div className="text-lg font-black text-white flex-1 text-center">
                  {match.team_1}
                </div>
                <div className="text-xs font-black text-gray-500 px-4">VS</div>
                <div className="text-lg font-black text-white flex-1 text-center">
                  {match.team_2}
                </div>
              </div>
              <div className="mt-3 text-center text-sm text-metallic-gold font-medium">
                {match.outcome_result ||
                  (match.outcome?.by?.runs
                    ? `${match.outcome.winner} won by ${match.outcome.by.runs} runs`
                    : match.outcome?.by?.wickets
                      ? `${match.outcome.winner} won by ${match.outcome.by.wickets} wickets`
                      : match.outcome?.result === "tie"
                        ? "Match Tied"
                        : match.outcome?.result === "no result"
                          ? "No Result"
                          : "Match Result Unavailable")}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "verdict" && (
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-2xl">
          <VerdictTool
            scope="series"
            context={{
              eventName: tournament.event_name,
              season: tournament.season,
            }}
          />
        </div>
      )}

      {["predict", "playingXI", "stories"].includes(activeTab) && (
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 shadow-2xl">
          <h3 className="text-xl font-black italic text-white mb-4 flex items-center gap-2 uppercase tracking-tighter">
            {activeTab === "predict" && <Zap className="text-metallic-gold" />}
            {activeTab === "playingXI" && (
              <Users className="text-metallic-gold" />
            )}
            {activeTab === "stories" && (
              <BookOpen className="text-metallic-gold" />
            )}
            {activeTab.replace(/([A-Z])/g, " $1").trim()}
          </h3>

          {aiLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="animate-spin text-metallic-gold" size={32} />
              <p className="text-gray-500 text-xs font-black uppercase tracking-widest animate-pulse">
                Oracle is analyzing tournament data...
              </p>
            </div>
          ) : (
            <div className="prose prose-invert max-w-none">
              <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                {aiContent[activeTab]}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

import { useVerdictStore } from "../store/verdictStore";

const MatchDetail: React.FC<{ matchId: number; onBack: () => void }> = ({
  matchId,
  onBack,
}) => {
  const [match, setMatch] = useState<MatchData | null>(null);
  const [mvp, setMvp] = useState<any>(null);
  const [scorecard, setScorecard] = useState<any[]>([]);
  const [showTop5, setShowTop5] = useState(false);
  const [officials, setOfficials] = useState<any>({
    field: [],
    tv: null,
    referee: null,
    reserve: null,
  });
  const [loading, setLoading] = useState(true);
  const [activeInning, setActiveInning] = useState(0);
  const [activeTab, setActiveTab] = useState<
    "scorecard" | "analytics" | "verdict"
  >("analytics");
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState<
    "momentum" | "heatmap" | "impact" | "mirror" | "radar"
  >("momentum");
  const { setPlayerProfileId } = useVerdictStore();

  useEffect(() => {
    setActiveInning(0);
  }, [matchId]);

  useEffect(() => {
    /**
     * Fetches match details, reconstructs match and scorecard data from deliveries, and updates component state.
     * @example
     * sync()
     * undefined
     * @returns {Promise<void>} A promise that resolves when match data has been loaded and state has been updated.
     **/
    const fetchMatchData = async () => {
      setLoading(true);
      try {
        const { getMatchDetails } =
          await import("../services/cockroachService");
        const response = await getMatchDetails(matchId.toString());

        const deliveries = response.deliveries || [];
        const info = response.info || {};

        if (deliveries && deliveries.length > 0) {
          // Reconstruct MatchData from deliveries and info
          const [firstBall] = deliveries;
          const reconstructedMatch: any = {
            match_id: matchId,
            match_date: info.date || firstBall.match_date,
            venue: info.venue || firstBall.venue,
            city: info.city || firstBall.city,
            match_type: info.match_type || firstBall.match_type,
            team_1: info.team_1 || "Team 1",
            team_2: info.team_2 || "Team 2",
            toss_winner: info.toss_winner,
            toss_decision: info.toss_decision,
            winner: info.winner,
            outcome_result: info.result,
            player_of_match: info.potm,
            umpires: info.umpires,
            raw_info: { info: info }, // For any tools needing raw_info
          };

          setMatch(reconstructedMatch);

          // Build scorecard from deliveries
          const inningsMap: Record<number, any> = {};
          deliveries.forEach((d: any) => {
            if (!inningsMap[d.innings]) {
              inningsMap[d.innings] = {
                team: `Innings ${d.innings}`,
                batters: {},
                bowlers: {},
                totalRuns: 0,
                totalWickets: 0,
                overs: 0,
                lastBall: 0,
              };
            }
            const inn = inningsMap[d.innings];
            inn.totalRuns += d.runs_total || 0;
            if (d.player_out) inn.totalWickets += 1;
            inn.overs = d.over;
            inn.lastBall = d.ball;

            // Batting
            if (!inn.batters[d.batter])
              inn.batters[d.batter] = {
                name: d.batter,
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0,
                dismissal: "not out",
              };
            inn.batters[d.batter].runs += d.runs_batter || 0;
            inn.batters[d.batter].balls += 1;
            if (d.runs_batter === 4) inn.batters[d.batter].fours += 1;
            if (d.runs_batter === 6) inn.batters[d.batter].sixes += 1;
            if (d.player_out === d.batter)
              inn.batters[d.batter].dismissal = d.wicket_kind || "out";

            // Bowling
            if (!inn.bowlers[d.bowler])
              inn.bowlers[d.bowler] = {
                name: d.bowler,
                runs: 0,
                balls: 0,
                wickets: 0,
                dots: 0,
              };
            inn.bowlers[d.bowler].runs += d.runs_total || 0;
            inn.bowlers[d.bowler].balls += 1;
            if (d.runs_total === 0) inn.bowlers[d.bowler].dots += 1;
            if (d.player_out && d.wicket_kind !== "run out")
              inn.bowlers[d.bowler].wickets += 1;
          });

          const finalScorecard = Object.values(inningsMap).map(
            (inn: any, idx: number) => ({
              ...inn,
              team: inn.team || `Innings ${idx + 1}`,
              batters: Object.values(inn.batters).map((b: any) => ({
                ...b,
                sr: ((b.runs / (b.balls || 1)) * 100).toFixed(1),
              })),
              bowlers: Object.values(inn.bowlers).map((b: any) => ({
                ...b,
                econ: ((b.runs / (b.balls || 1)) * 6).toFixed(1),
              })),
              overs: `${inn.overs}.${inn.lastBall}`,
            }),
          );

          setScorecard(finalScorecard);
          if (finalScorecard.length > 0) {
            setMvp(calculateFallbackMvp(finalScorecard));
          }
        }
      } catch (err) {
        console.error("Error fetching match data:", err);
      }
      setLoading(false);
    };
    fetchMatchData();
  }, [matchId]);

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-aurora-teal" size={32} />
      </div>
    );
  if (!match || scorecard.length === 0)
    return (
      <div className="text-white text-center py-20 space-y-4">
        <div className="p-4 bg-white/5 rounded-full w-fit mx-auto">
          <Activity size={32} className="text-gray-600" />
        </div>
        <p>Match data is being synced or not available.</p>
        <button
          onClick={onBack}
          className="text-metallic-gold text-xs font-black uppercase tracking-widest hover:underline"
        >
          Go Back
        </button>
      </div>
    );

  const team1 = match.team_1 || scorecard[0]?.team || "Team 1";
  const team2 = match.team_2 || scorecard[1]?.team || "Team 2";

  // Safe Result Calculation
  let matchResult = match.outcome_result || "Match in Progress";
  if (match.winner) {
    const outcomeStr =
      match.outcome_result === "runs"
        ? `by ${match.by_runs || ""} runs`
        : match.outcome_result === "wickets"
          ? `by ${match.by_wickets || ""} wickets`
          : "";
    matchResult = `${match.winner} won ${outcomeStr}`;
  } else if (scorecard.length >= 2 && !match.outcome_result) {
    const s1 = scorecard[0].totalRuns;
    const s2 = scorecard[1].totalRuns;
    if (s1 > s2) matchResult = `${team1} won by ${s1 - s2} runs`;
    else if (s2 > s1) matchResult = `${team2} won by ${s2 - s1} runs`;
    else matchResult = "Match Tied";
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-6 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl space-y-6"
    >
      <div className="text-center space-y-2">
        <div className="flex justify-center items-center gap-3">
          <div className="text-xs font-black text-aurora-teal uppercase tracking-widest">
            {match?.match_type || "T20"}
          </div>
          <div className="size-1 rounded-full bg-white/20" />
          <div className="text-xs font-black text-aurora-teal uppercase tracking-widest">
            {match?.match_date
              ? new Date(match.match_date).getFullYear()
              : "Archive"}
          </div>
        </div>
        <h2 className="text-2xl font-black italic text-white">
          {team1} <span className="text-gray-500 text-lg">vs</span> {team2}
        </h2>
        <div className="text-sm text-metallic-gold font-bold">
          {matchResult}
        </div>
      </div>

      {/* Crinava MVP Section */}
      <div className="bg-gradient-to-br from-metallic-gold/20 to-transparent border border-metallic-gold/30 p-5 rounded-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Star size={64} />
        </div>

        <div className="flex justify-between items-start mb-3">
          <h3 className="text-sm font-black text-metallic-gold uppercase tracking-wider flex items-center gap-2">
            <Trophy size={16} /> Crinava Match MVP
          </h3>
          {mvp && mvp.length > 1 && (
            <button
              onClick={() => setShowTop5(!showTop5)}
              className="text-metallic-gold hover:text-white transition-colors p-1"
            >
              <ChevronRight
                className={`transition-transform ${showTop5 ? "rotate-90" : ""}`}
                size={20}
              />
            </button>
          )}
        </div>

        {mvp && mvp.length > 0 ? (
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-black text-white mb-1">
                {mvp[0].player_name}
              </div>
              <div className="flex items-end gap-3">
                <div className="text-3xl font-black text-metallic-gold">
                  {Number(mvp[0].total_impact_score).toFixed(1)}{" "}
                  <span className="text-sm text-gray-400 font-normal">
                    Impact Score
                  </span>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showTop5 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pt-4 border-t border-white/10 space-y-2"
                >
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                    Top 5 Impact Players
                  </div>
                  {mvp?.slice(1)?.map((p: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between items-center bg-white/5 p-2 rounded"
                    >
                      <span className="text-sm text-white font-medium">
                        {p.player_name}
                      </span>
                      <span className="text-sm font-black text-metallic-gold">
                        {Number(p.total_impact_score).toFixed(1)}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-gray-400 text-sm italic">
            MVP calculation pending...
          </div>
        )}
      </div>

      {/* POTM */}
      <div className="bg-white/5 p-4 rounded-xl flex items-center gap-4">
        <Trophy className="text-metallic-gold" size={24} />
        <div>
          <div className="text-gray-500 text-xs">Player of the Match</div>
          <div className="text-white font-bold">{match.player_of_match || 'N/A'}</div>
        </div>
      </div>

      {/* Match Result Box */}
      <div className="bg-metallic-gold/10 border border-metallic-gold/30 p-4 rounded-xl text-center">
        <div className="text-metallic-gold font-black text-lg">
          {matchResult}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex bg-[#1a1a1a] rounded-xl p-1 border border-white/10">
        <button
          onClick={() => setActiveTab("scorecard")}
          className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === "scorecard" ? "bg-metallic-gold text-black" : "text-gray-400 hover:text-white"}`}
        >
          <Activity size={18} /> Scorecard
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === "analytics" ? "bg-aurora-teal text-black" : "text-gray-400 hover:text-white"}`}
        >
          <Zap size={18} /> Advanced Analytics
        </button>
        <button
          onClick={() => setActiveTab("verdict")}
          className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === "verdict" ? "bg-aurora-teal text-black" : "text-gray-400 hover:text-white"}`}
        >
          <Gavel size={18} /> Verdict
        </button>
      </div>

      {activeTab === "scorecard" ? (
        <>
          {/* Scorecard Section */}
          {scorecard.length > 0 ? (
            <div className="space-y-4">
              {/* Innings Tabs */}
              <div className="flex bg-[#1a1a1a] rounded-xl p-1 border border-white/10">
                {scorecard?.map((inning: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveInning(idx)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeInning === idx ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"}`}
                  >
                    {inning.team}
                  </button>
                ))}
              </div>

              {/* Active Innings Display */}
              <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
                <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex justify-between items-center">
                  <h4 className="font-bold text-white">
                    {scorecard[activeInning]?.team || "Unknown Team"} Innings
                  </h4>
                  <span className="font-black text-metallic-gold">
                    {scorecard[activeInning]?.totalRuns || 0}/
                    {scorecard[activeInning]?.totalWickets || 0}{" "}
                    <span className="text-xs text-gray-400 font-normal">
                      ({scorecard[activeInning]?.overs || "0.0"} ov)
                    </span>
                  </span>
                </div>

                {/* Batting Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 bg-black/20 uppercase">
                      <tr>
                        <th className="px-4 py-2">Batter</th>
                        <th className="px-4 py-2 text-right">R</th>
                        <th className="px-4 py-2 text-right">B</th>
                        <th className="px-4 py-2 text-right">4s</th>
                        <th className="px-4 py-2 text-right">6s</th>
                        <th className="px-4 py-2 text-right">SR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {scorecard[activeInning]?.batters?.map(
                        (b: any, idx: number) => (
                          <tr
                            key={`${b.name}-${idx}`}
                            className="hover:bg-white/[0.02]"
                          >
                            <td className="px-4 py-2 font-medium text-white">
                              <button
                                onClick={() => setPlayerProfileId(b.name)}
                                className="hover:text-metallic-gold transition-colors text-left"
                              >
                                {b.name}
                              </button>
                              <div className="text-gray-500 text-xs font-normal">
                                {b.dismissal}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-right font-bold text-white">
                              {b.runs}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-400">
                              {b.balls}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-400">
                              {b.fours}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-400">
                              {b.sixes}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-400">
                              {b.sr}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Did Not Bat */}
                {scorecard[activeInning]?.didNotBat &&
                  scorecard[activeInning]?.didNotBat?.length > 0 && (
                    <div className="px-4 py-3 border-t border-white/10 text-sm">
                      <span className="font-bold text-gray-400">
                        Did not bat:{" "}
                      </span>
                      <span className="text-gray-500">
                        {scorecard[activeInning]?.didNotBat.join(", ")}
                      </span>
                    </div>
                  )}

                {/* Bowling Table */}
                <div className="overflow-x-auto border-t border-white/10">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 bg-black/20 uppercase">
                      <tr>
                        <th className="px-4 py-2">Bowler</th>
                        <th className="px-4 py-2 text-right">O</th>
                        <th className="px-4 py-2 text-right">R</th>
                        <th className="px-4 py-2 text-right">W</th>
                        <th className="px-4 py-2 text-right">Econ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {scorecard[activeInning]?.bowlers?.map(
                        (b: any, idx: number) => {
                          const overs =
                            Math.floor(b.balls / 6) + (b.balls % 6) / 10;
                          return (
                            <tr
                              key={`${b.name}-${idx}`}
                              className="hover:bg-white/[0.02]"
                            >
                              <td className="px-4 py-2 font-medium text-white">
                                <button
                                  onClick={() => setPlayerProfileId(b.name)}
                                  className="hover:text-metallic-gold transition-colors text-left"
                                >
                                  {b.name}
                                </button>
                              </td>
                              <td className="px-4 py-2 text-right text-gray-400">
                                {overs}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-400">
                                {b.runs}
                              </td>
                              <td className="px-4 py-2 text-right font-bold text-white">
                                {b.wickets}
                              </td>
                              <td className="px-4 py-2 text-right text-gray-400">
                                {b.econ}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 italic bg-white/5 p-6 rounded-xl">
              Detailed scorecard data is not available for this match.
            </div>
          )}
        </>
      ) : activeTab === "verdict" ? (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
          <VerdictTool
            scope="match"
            context={{ matchId: matchId, scorecard: scorecard }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sub-tabs for Advanced Analytics */}
          <div className="flex overflow-x-auto pb-2 scrollbar-hide gap-2 border-b border-white/5">
            {[
              { id: "momentum", label: "Momentum Map", icon: Activity },
              { id: "heatmap", label: "Turning Points", icon: TrendingUp },
              { id: "impact", label: "Ball Impact", icon: Zap },
              { id: "mirror", label: "Mirror Match", icon: Zap },
              { id: "gap", label: "Execution Gap", icon: Activity },
              { id: "radar", label: "Impact Radar", icon: Trophy },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveAnalyticsTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeAnalyticsTab === tab.id
                    ? "bg-aurora-teal text-black shadow-[0_0_15px_rgba(17,235,207,0.3)]"
                    : "bg-white/5 text-gray-500 hover:bg-white/10"
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-[500px]">
            {activeAnalyticsTab === "momentum" && (
              <MomentumMap rawInfo={match.raw_info} />
            )}
            {activeAnalyticsTab === "heatmap" && (
              <TurningPointHeatmap rawInfo={match.raw_info} />
            )}
            {activeAnalyticsTab === "impact" && (
              <BallByBallImpact rawInfo={match.raw_info} />
            )}
            {activeAnalyticsTab === "mirror" && (
              <MirrorMatch
                rawInfo={match.raw_info}
                venue={match.venue || ""}
                matchType={match.match_type}
              />
            )}
            {activeAnalyticsTab === "radar" && (
              <PlayerImpactRadar
                rawInfo={match.raw_info}
                playerId={mvp && mvp.length > 0 ? mvp[0].player_name : ""}
                allPlayers={Array.from(
                  new Set(
                    scorecard.flatMap((inning) => [
                      ...(inning.batters || []).map((b: any) => b.name),
                      ...(inning.bowlers || []).map((b: any) => b.name),
                    ]),
                  ),
                )}
              />
            )}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-black italic text-white flex items-center gap-2">
          <Info size={20} className="text-aurora-teal" /> Match Info
        </h3>
        <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 space-y-3">
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Toss</span>
            <span className="text-white font-medium text-right">
              {match.toss_winner_id
                ? `${match.toss_winner_id} won the toss and elected to ${match.toss_decision}`
                : "N/A"}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Venue</span>
            <span className="text-white font-medium text-right">
              {match.venue}
              {match.city ? `, ${match.city}` : ""}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Date</span>
            <span className="text-white font-medium text-right">
              {match.match_date || "N/A"}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Player of the Match</span>
            <span className="text-metallic-gold font-bold text-right">
              {match.player_of_match || "N/A"}
            </span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Umpires</span>
            <span className="text-white font-medium text-right">
              {match.umpires || "N/A"}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface LiveMatch {
  [key: string]: any;
  title: string;
  match_id: string;
  source: string;
  is_tracked: boolean;
  state?: string;
}

interface LivePacket {
  event_key?: string;
  over_ball: string;
  runs_scored: string;
  score: string;
  commentary: string;
  raw_commentary?: string;
  type?: string;
  win_predictor?: {
    teamA?: string;
    teamB?: string;
    batting_team?: string;
    bowling_team?: string;
    winA?: number;
    winB?: number;
    win_probability?: number;
    innings_no?: number;
    target?: number;
    runs_needed?: number;
    balls_remaining?: number;
    wickets_left?: number;
  };
  flavor?: string[];
  data?: any;
  player_map?: Record<string, string>;
  telemetry?: any;
  extras?: any;
  scorecard_cache?: any;
}

const getApiBaseUrl = () => {
  const envUrl = (import.meta.env as any).VITE_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return `http://${host}:7860`;
  }
  return "https://jathit2645-crinava-live-engine.hf.space";
};

/**
* Renders a live matches section with search, state filtering, polling-based data refresh, and match selection handling.
* @example
* MatchesSection({ onSelect: handleSelect })
* <MatchesSection onSelect={handleSelect} />
* @param {{(match: LiveMatch) => void}} onSelect - Callback invoked when a match card is clicked.
* @returns {JSX.Element} A JSX element displaying loading, error, empty, or filtered match results.
**/
const LiveMatchesList: React.FC<{ onSelect: (m: LiveMatch) => void }> = ({
  onSelect,
}) => {
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");

  useEffect(() => {
    /**
    * Fetches live matches from the API and updates the component state.
    * @example
    * sync()
    * void
    * @returns {void} No return value.
    **/
    const fetchLive = async () => {
      try {
        setError(null);
        const base = getApiBaseUrl();
        const url = `${base}/matches`;

        const resp = await fetch(url);
        if (!resp.ok) throw new Error("Failed to fetch live matches");
        const data = await resp.json();
        setLiveMatches(data);
      } catch (e: any) {
        console.error(e);
        setError(
          "Unable to connect to live score engine. Make sure FastAPI server is running on port 7860.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredMatches = liveMatches.filter((m) => {
    const matchesSearch =
      !searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState =
      stateFilter === "all" ||
      (m.state || "Live").toLowerCase() === stateFilter.toLowerCase();
    return matchesSearch && matchesState;
  });

  const stateCounts = {
    all: liveMatches.length,
    live: liveMatches.filter((m) => (m.state || "Live") === "Live").length,
    upcoming: liveMatches.filter((m) => m.state === "Upcoming").length,
    completed: liveMatches.filter((m) => m.state === "Completed").length,
  };

  if (loading && liveMatches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin text-metallic-gold" size={32} />
        <p className="text-gray-500 text-xs font-black uppercase tracking-widest animate-pulse">
          Scanning live feeds...
        </p>
      </div>
    );
  }

  if (error && liveMatches.length === 0) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-4">
        <p className="text-sm text-red-400 font-bold">{error}</p>
        <button
          onClick={() => console.log("RELOAD BLOCKED")}
          className="px-6 py-2 bg-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-500/30 transition-all"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (liveMatches.length === 0) {
    return (
      <div className="p-12 bg-[#111111] border border-white/5 rounded-3xl text-center space-y-4">
        <div className="size-16 rounded-full bg-white/5 flex items-center justify-center border border-dashed border-white/10 mx-auto">
          <Activity size={30} className="text-gray-700" />
        </div>
        <p className="text-xs text-gray-500 font-black uppercase tracking-widest">
          No active matches found in the discovery engine
        </p>
        <p className="text-[10px] text-gray-600">
          Active matches will automatically appear here once detected on
          Crex/NDTV.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
          size={16}
        />
        <input
          type="text"
          placeholder="Search matches by team, league, or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-[#111111] border border-white/10 rounded-2xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-aurora-teal/40 focus:ring-1 focus:ring-aurora-teal/20 transition-all font-medium"
        />
      </div>

      {/* State Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "live", "upcoming", "completed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStateFilter(s)}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              stateFilter === s
                ? s === "live"
                  ? "bg-aurora-teal/20 border-aurora-teal/40 text-aurora-teal"
                  : s === "upcoming"
                    ? "bg-metallic-gold/20 border-metallic-gold/40 text-metallic-gold"
                    : s === "completed"
                      ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                      : "bg-white/10 border-white/20 text-white"
                : "bg-white/[0.02] border-white/5 text-gray-500 hover:text-white hover:border-white/10"
            }`}
          >
            {s} ({stateCounts[s]})
          </button>
        ))}
      </div>

      {/* Matches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMatches.length > 0 ? (
          filteredMatches.map((match) => {
            const matchState = match.state || "Live";
            const stateColors: Record<string, string> = {
              Live: "bg-aurora-teal text-aurora-teal",
              Upcoming: "bg-metallic-gold text-metallic-gold",
              Completed: "bg-blue-400 text-blue-400",
            };
            const dotColor = stateColors[matchState] || stateColors["Live"];
            return (
              <div
                key={match.match_id}
                onClick={() => onSelect(match)}
                className="p-6 rounded-2xl bg-gradient-to-br from-white/[0.02] to-transparent border border-white/5 hover:border-aurora-teal/30 hover:shadow-[0_0_20px_rgba(17,235,207,0.05)] cursor-pointer transition-all space-y-4 group relative overflow-hidden"
              >
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <span className="flex size-2 relative">
                    {matchState === "Live" && (
                      <span
                        className={`animate-ping absolute inline-flex size-full rounded-full ${dotColor.split(" ")[0]} opacity-75`}
                      ></span>
                    )}
                    <span
                      className={`relative inline-flex rounded-full size-2 ${dotColor.split(" ")[0]}`}
                    ></span>
                  </span>
                  <span
                    className={`text-[8px] font-black uppercase tracking-widest ${dotColor.split(" ")[1]}`}
                  >
                    {matchState}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-[8px] font-black text-metallic-gold uppercase tracking-[0.2em]">
                    {match.source} Source
                  </div>
                  <h3 className="text-lg font-black text-white italic group-hover:text-aurora-teal transition-colors leading-tight pr-10">
                    {match.title}
                  </h3>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-white/5">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                    {match.is_tracked ? "Active Telemetry" : "Ready to Track"}
                  </span>
                  <ChevronRight
                    className="text-gray-500 group-hover:text-aurora-teal group-hover:translate-x-1 transition-all"
                    size={16}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center text-gray-500 italic bg-white/[0.01] border border-white/5 rounded-3xl">
            No matches found matching your search.
          </div>
        )}
      </div>
    </div>
  );
};

const LiveMatchDetail: React.FC<{ match: LiveMatch; onBack: () => void }> = ({
  match,
  onBack,
}) => {
  const [history, setHistory] = useState<LivePacket[]>([]);
  const [currentScore, setCurrentScore] = useState<string>("Syncing...");
  const [statusColor, setStatusColor] = useState<string>("text-gray-400");
  const [connected, setConnected] = useState<boolean>(false);
  const [liveTab, setLiveTab] = useState<"commentary" | "scorecard" | "graphs">(
    "commentary",
  );
  const [scorecardData, setScorecardData] = useState<any>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<any>(null);
  const [winHistory, setWinHistory] = useState<
    { over: string; winA: number; winB: number; teamA: string; teamB: string }[]
  >([]);
  const [activeScorecardInning, setActiveScorecardInning] = useState<number>(0);

  useEffect(() => {
    const base = getApiBaseUrl();

    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    /**
     * Processes incoming live match packets and updates score, telemetry, win prediction, and history state.
     * @example
     * handlePacket(packet)
     * undefined
     * @param {LivePacket} packet - Incoming live packet containing score, telemetry, scorecard cache, and win predictor data.
     * @returns {void} No return value.
     **/
    const addPacket = (packet: LivePacket) => {
      // Handle scorecard type packets from SSE
      if (packet.type === "scorecard") {
        setScorecardData(packet);
        if (packet.telemetry) setLatestTelemetry(packet.telemetry);
        return;
      }

      if (packet.telemetry) setLatestTelemetry(packet.telemetry);
      if (packet.scorecard_cache?.data?.length) {
        setScorecardData((prev: any) => ({
          ...(prev || {}),
          ...packet.scorecard_cache,
          player_map: prev?.player_map || packet.player_map || {},
        }));
      }

      if (packet.score) {
        setCurrentScore(packet.score);
        setStatusColor("text-aurora-teal");
      }

      if (packet.win_predictor) {
        const wp = packet.win_predictor;

        let winA = 50,
          winB = 50;
        let teamA =
          wp.batting_team ||
          wp.teamA ||
          match.title.split(/ vs /i)[0]?.trim() ||
          "Team 1";
        let teamB =
          wp.bowling_team ||
          wp.teamB ||
          match.title.split(/ vs /i)[1]?.split(" ")[0]?.trim() ||
          "Team 2";

        if (wp.win_probability !== undefined) {
          // If the ML model returns win_probability (usually for batting team)
          winA = wp.win_probability;
          winB = 100 - winA;
        } else if (wp.winA !== undefined && wp.winB !== undefined) {
          // If it directly returns winA and winB
          winA = wp.winA;
          winB = wp.winB;
          teamA = wp.teamA || teamA;
          teamB = wp.teamB || teamB;
        }

        // The user noted the win % was inverted (e.g. GT won but RR showed 100%).
        // To fix this, we ensure team labels correctly map to their respective win probabilities.
        // If the model gives batting_team=RR, bowling_team=GT, and win_probability=100 (RR won),
        // we display RR: 100%, GT: 0%.

        setWinHistory((prev) => {
          const entry = {
            over: packet.event_key || packet.over_ball,
            winA,
            winB,
            teamA,
            teamB,
          };
          const exists = prev.find((e) => e.over === entry.over);
          if (exists) return prev;
          return [...prev, entry];
        });
      }

      setHistory((prev) => {
        const packetKey =
          packet.event_key || `${packet.over_ball}:${packet.runs_scored}`;
        const index = prev.findIndex(
          (p) =>
            (p.event_key || `${p.over_ball}:${p.runs_scored}`) === packetKey,
        );
        if (index !== -1) {
          if (prev[index].commentary === packet.commentary) {
            return prev;
          }
          const updated = [...prev];
          updated[index] = packet;
          return updated;
        }
        return [packet, ...prev];
      });
    };

    /**
    * Fetches match history packets and starts periodic synchronization of live score updates.
    * @example
    * syncMatchHistory(match)
    * "Waiting for first ball..."
    * @param {object} match - Match object containing the match_id used to load history.
    * @returns {void} No value is returned; the function triggers side effects such as state updates and polling.
    **/
    const startPollingFallback = () => {
      /**
       * Synchronizes match history from the server and updates the current score or error state.
       * @example
       * sync()
       * undefined
       * @returns {void} No value is returned.
      **/
      const sync = async () => {
        try {
          const resp = await fetch(`${base}/history/${match.match_id}`);
          if (!resp.ok) throw new Error("History fetch failed");
          const data = await resp.json();
          if (data && data.length > 0) {
            data.forEach((p: LivePacket) => addPacket(p));
          } else {
            setCurrentScore("Waiting for first ball...");
            setStatusColor("text-metallic-gold");
          }
        } catch (e) {
          setCurrentScore("Sync error. Retrying...");
          setStatusColor("text-red-500");
        }
      };

      sync();
      pollInterval = setInterval(sync, 3000);
    };

    try {
      eventSource = new EventSource(`${base}/stream/${match.match_id}`);
      setConnected(true);

      eventSource.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          addPacket(packet);
        } catch (e) {
          console.error("SSE parse error", e);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE stream interrupted, trying polling fallback", err);
        setConnected(false);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        startPollingFallback();
      };
    } catch (e) {
      console.error("SSE connection failed, using polling", e);
      setConnected(false);
      startPollingFallback();
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [match.match_id]);

  // Poll scorecard every 10 seconds
  useEffect(() => {
    const base = getApiBaseUrl();
    /**
    * Fetches the scorecard data for the current match and updates state with the latest scorecard and telemetry.
    * @example
    * sync()
    * undefined
    * @returns {Promise<void>} Resolves when the scorecard fetch and any state updates are complete.
    **/
    const fetchScorecard = async () => {
      try {
        const resp = await fetch(`${base}/scorecard/${match.match_id}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data && Object.keys(data).length > 0) {
            setScorecardData(data);
            if (data.telemetry) setLatestTelemetry(data.telemetry);
          }
        }
      } catch (e) {
        /* silent */
      }
    };
    fetchScorecard();
    const interval = setInterval(fetchScorecard, 10000);
    return () => clearInterval(interval);
  }, [match.match_id]);

  // Derive latest win prediction
  const latestWin =
    winHistory.length > 0 ? winHistory[winHistory.length - 1] : null;

  // Helper: render scorecard from backend data
  /**
   * Renders the live scorecard panel for a match, including current players, innings tabs, batting and bowling tables, extras, partnerships, and dismissals.
   * @example
   * MatchesSection({ scorecardData, latestTelemetry, match, activeScorecardInning, setActiveScorecardInning })
   * <ScorecardPanel />
   * @param {{object}} scorecardData - Scorecard payload containing innings data, player mapping, telemetry, and extras.
   * @param {{object}} latestTelemetry - Most recent live telemetry used as a fallback for active players and extras.
   * @param {{object}} match - Match metadata used to resolve fallback team names.
   * @param {{number}} activeScorecardInning - Index of the currently selected innings.
   * @param {{function}} setActiveScorecardInning - State updater used to switch the active innings tab.
   * @returns {JSX.Element} A JSX scorecard view, loading state, or fetching state depending on available data.
   **/
  const renderScorecard = () => {
    if (!scorecardData)
      return (
        <div className="py-12 text-center text-gray-500 italic bg-white/[0.01] border border-white/5 rounded-3xl">
          Scorecard loading... Will auto-refresh every 10s.
        </div>
      );
    const sc = scorecardData.data || scorecardData;
    const playerMap = scorecardData.player_map || {};
    const resolveName = (id: string) =>
      playerMap[id?.toString()?.toUpperCase()] ||
      playerMap[id] ||
      id ||
      "Unknown";
    const innings = Array.isArray(sc) ? sc : sc?.i || sc?.innings || [];
    if (!Array.isArray(innings) || innings.length === 0)
      return (
        <div className="py-12 text-center text-gray-500 italic bg-white/[0.01] border border-white/5 rounded-3xl">
          Scorecard data is being fetched by the engine...
        </div>
      );
    const telemetry = scorecardData.telemetry || latestTelemetry || {};
    const active = telemetry.active || {};
    const striker = telemetry.striker || active.striker;
    const nonStriker = telemetry.non_striker || active.non_striker;
    const bowler = telemetry.bowler || active.bowler;
    const liveExtras = telemetry.extras || {};
    const playerLine = (player: any) => {
      if (!player) return "Waiting";
      const name = resolveName(player.n || player.id);
      if (player.r !== undefined && player.b !== undefined)
        return `${name} ${player.r} (${player.b})`;
      if (player.o !== undefined)
        return `${name} ${player.o}-${player.m ?? 0}-${player.r ?? 0}-${player.w ?? 0}`;
      return name;
    };
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            ["Striker", playerLine(striker), "text-aurora-teal"],
            ["Non-striker", playerLine(nonStriker), "text-metallic-gold"],
            ["Bowler", playerLine(bowler), "text-white"],
            [
              "Extras",
              liveExtras?.total !== undefined
                ? `${liveExtras.total} (b ${liveExtras.byes || 0}, lb ${liveExtras.legByes || 0}, w ${liveExtras.wides || 0}, nb ${liveExtras.noBalls || 0})`
                : "Waiting",
              "text-gray-300",
            ],
          ].map(([label, value, color]) => (
            <div
              key={label}
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-4"
            >
              <div className="text-[8px] text-gray-500 font-black uppercase tracking-widest">
                {label}
              </div>
              <div className={`mt-1 text-sm font-black ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        {/* Innings Subtabs */}
        {innings.length > 0 && (
          <div className="flex bg-[#111111] border border-white/10 p-1 rounded-2xl">
            {innings.map((inn: any, idx: number) => {
              const fallbackName =
                idx === 0 ? match.team1 || "Team A" : match.team2 || "Team B";
              const tName =
                resolveName(inn.tn) !== inn.tn
                  ? resolveName(inn.tn)
                  : fallbackName;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveScorecardInning(idx)}
                  className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeScorecardInning === idx ? "bg-aurora-teal text-black" : "text-gray-400 hover:text-white"}`}
                >
                  {tName}
                </button>
              );
            })}
          </div>
        )}

        {[innings[activeScorecardInning]].filter(Boolean).map((inn: any) => {
          const iIdx = activeScorecardInning;
          const rawBatters = inn.batters || inn.b || inn.batsmen || [];
          const rawBowlers = inn.bowlers || inn.bo || inn.a || [];

          const batters = rawBatters.map((bat: any) => {
            if (typeof bat === "string") {
              const parts = bat.split(".");
              return {
                id: parts[0],
                r: parts[1],
                b: parts[2],
                f: parts[3], // 4s
                s: parts[4], // 6s
                sr:
                  parts[5] ||
                  (parts[2] && Number(parts[2]) > 0
                    ? ((Number(parts[1]) / Number(parts[2])) * 100).toFixed(1)
                    : "-"),
                dismissal_type: parts[6] || "",
                wicket_bowler: parts[8] || "",
                wicket_fielder: parts[9] ? parts[9].split("/")[0] : "",
              };
            }
            return bat;
          });

          const bowlers = rawBowlers.map((bwl: any) => {
            if (typeof bwl === "string") {
              // Bowlers might be dot-separated or slash-separated depending on the specific field
              const parts = bwl.split(/[./]/);
              return {
                id: parts[0],
                o: parts[1],
                m: parts[2],
                r: parts[3],
                w: parts[4],
                e:
                  parts[5] ||
                  (parts[1] && Number(parts[1]) > 0
                    ? (Number(parts[3]) / Number(parts[1])).toFixed(1)
                    : "-"),
              };
            }
            return bwl;
          });

          const fallbackTeamName =
            iIdx === 0 ? match.team1 || "Team A" : match.team2 || "Team B";
          const teamName =
            resolveName(inn.tn) !== inn.tn
              ? resolveName(inn.tn)
              : fallbackTeamName;
          const totalScore = inn.r ?? inn.runs ?? "-";
          const totalWkts = inn.w ?? inn.wickets ?? "-";
          const totalOvers = inn.o ?? inn.overs ?? "-";
          const extras = inn.extras || {};
          const partnerships = inn.partnerships || [];
          const dismissals = inn.dismissal_timeline || [];
          return (
            <div
              key={iIdx}
              className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden"
            >
              <div className="px-5 py-3 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
                <span className="font-black text-white text-sm uppercase tracking-wider">
                  {teamName}
                </span>
                <span className="font-black text-metallic-gold text-sm">
                  {totalScore}/{totalWkts}{" "}
                  <span className="text-xs text-gray-400 font-normal">
                    ({totalOvers} ov)
                  </span>
                </span>
              </div>
              {extras?.total !== undefined && (
                <div className="px-5 py-2 text-[10px] text-gray-400 border-b border-white/5">
                  Extras:{" "}
                  <span className="text-white font-bold">{extras.total}</span>
                  <span className="ml-2">
                    b {extras.byes || 0}, lb {extras.legByes || 0}, w{" "}
                    {extras.wides || 0}, nb {extras.noBalls || 0}
                  </span>
                </div>
              )}
              {batters.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-white/5">
                        <th className="text-left px-4 py-2 font-bold">
                          BATTER
                        </th>
                        <th className="p-2 font-bold">R</th>
                        <th className="p-2 font-bold">B</th>
                        <th className="p-2 font-bold">4s</th>
                        <th className="p-2 font-bold">6s</th>
                        <th className="p-2 font-bold">SR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batters.map((bat: any, bIdx: number) => (
                        <tr
                          key={bIdx}
                          className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-2">
                            <div className="text-white font-semibold flex items-center gap-2">
                              {resolveName(bat.id || bat.n)}
                              {!bat.wicket_bowler && bat.r !== undefined && (
                                <span className="text-[9px] text-aurora-teal px-1.5 py-0.5 rounded bg-aurora-teal/10">
                                  *
                                </span>
                              )}
                            </div>
                            {(bat.wicket_bowler || bat.wicket_fielder) && (
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                {(() => {
                                  const bowler = resolveName(bat.wicket_bowler);
                                  const fielder = resolveName(
                                    bat.wicket_fielder,
                                  );
                                  const type = String(bat.dismissal_type || "");
                                  if (type === "1" || type === "b")
                                    return `b ${bowler}`;
                                  if (type === "2" || type === "c")
                                    return `c ${fielder} b ${bowler}`;
                                  if (type === "3" || type === "lbw")
                                    return `lbw b ${bowler}`;
                                  if (type === "4" || type === "run out")
                                    return `run out (${fielder})`;
                                  if (type === "5" || type === "st")
                                    return `st ${fielder} b ${bowler}`;
                                  if (fielder && bowler)
                                    return `c ${fielder} b ${bowler}`;
                                  if (bowler) return `b ${bowler}`;
                                  return "out";
                                })()}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center text-white font-bold">
                            {bat.r ?? "-"}
                          </td>
                          <td className="p-2 text-center text-gray-400">
                            {bat.b ?? "-"}
                          </td>
                          <td className="p-2 text-center text-metallic-gold">
                            {bat.f ?? "-"}
                          </td>
                          <td className="p-2 text-center text-aurora-teal">
                            {bat.s ?? "-"}
                          </td>
                          <td className="p-2 text-center text-gray-300">
                            {bat.sr ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {bowlers.length > 0 && (
                <div className="overflow-x-auto border-t border-white/5">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-white/5">
                        <th className="text-left px-4 py-2 font-bold">
                          BOWLER
                        </th>
                        <th className="p-2 font-bold">O</th>
                        <th className="p-2 font-bold">M</th>
                        <th className="p-2 font-bold">R</th>
                        <th className="p-2 font-bold">W</th>
                        <th className="p-2 font-bold">ECON</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bowlers.map((bwl: any, bIdx: number) => (
                        <tr
                          key={bIdx}
                          className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-2 text-white font-semibold">
                            {resolveName(bwl.id || bwl.n)}
                          </td>
                          <td className="p-2 text-center text-gray-400">
                            {bwl.o ?? "-"}
                          </td>
                          <td className="p-2 text-center text-gray-400">
                            {bwl.m ?? "-"}
                          </td>
                          <td className="p-2 text-center text-white font-bold">
                            {bwl.r ?? "-"}
                          </td>
                          <td className="p-2 text-center text-red-400 font-bold">
                            {bwl.w ?? "-"}
                          </td>
                          <td className="p-2 text-center text-gray-300">
                            {bwl.e ?? "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(partnerships.length > 0 || dismissals.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-t border-white/5 text-xs">
                  {partnerships.length > 0 && (
                    <div className="p-4 border-b md:border-b-0 md:border-r border-white/5">
                      <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">
                        Latest Partnerships
                      </div>
                      {partnerships.slice(-3).map((p: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex justify-between py-1 text-gray-300"
                        >
                          <span>
                            {p.p1} / {p.p2}
                          </span>
                          <span className="font-black text-white">
                            {p.runs} ({p.balls})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {dismissals.length > 0 && (
                    <div className="p-4">
                      <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">
                        Dismissals
                      </div>
                      {dismissals.slice(-4).map((d: any, idx: number) => (
                        <div key={idx} className="py-1 text-gray-300">
                          <span className="text-white font-semibold">
                            {d.player}
                          </span>
                          {d.bowler ? (
                            <span className="text-gray-500">
                              {" "}
                              by {d.bowler}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // SVG Win % Momentum Graph
  /**
   * Renders a cricket win-probability trend graph and per-ball run-flow visualization.
   * @example
   * renderMatchMomentumChart()
   * <div>...</div>
   * @param {Array} winHistory - Array of win probability data points for teams A and B over time.
   * @returns {JSX.Element|null} A JSX element containing the charts, or a placeholder message when insufficient data is available.
   **/
  const renderGraph = () => {
    if (winHistory.length < 2)
      return (
        <div className="py-12 text-center text-gray-500 italic bg-white/[0.01] border border-white/5 rounded-3xl">
          Win prediction graph will appear after 2+ data points are received...
        </div>
      );
    const w = 700,
      h = 250,
      pad = 40;
    const pw = (w - pad * 2) / (winHistory.length - 1);
    const scaleY = (v: number) => pad + ((100 - v) / 100) * (h - pad * 2);
    const pathA = winHistory
      .map((p, i) => `${i === 0 ? "M" : "L"}${pad + i * pw},${scaleY(p.winA)}`)
      .join(" ");
    const pathB = winHistory
      .map((p, i) => `${i === 0 ? "M" : "L"}${pad + i * pw},${scaleY(p.winB)}`)
      .join(" ");
    const teamA = winHistory[0]?.teamA || "Team A";
    const teamB = winHistory[0]?.teamB || "Team B";
    return (
      <div className="space-y-4">
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 overflow-x-auto">
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full"
            style={{ minWidth: 400 }}
          >
            <line
              x1={pad}
              y1={scaleY(50)}
              x2={w - pad}
              y2={scaleY(50)}
              stroke="rgba(255,255,255,0.1)"
              strokeDasharray="4"
            />
            <text
              x={pad - 5}
              y={scaleY(100) + 4}
              fill="#666"
              fontSize="9"
              textAnchor="end"
            >
              100%
            </text>
            <text
              x={pad - 5}
              y={scaleY(50) + 4}
              fill="#666"
              fontSize="9"
              textAnchor="end"
            >
              50%
            </text>
            <text
              x={pad - 5}
              y={scaleY(0) + 4}
              fill="#666"
              fontSize="9"
              textAnchor="end"
            >
              0%
            </text>
            <path
              d={pathA}
              fill="none"
              stroke="#11EBCF"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d={pathB}
              fill="none"
              stroke="#FFD700"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {winHistory.map((p, i) => (
              <g key={i}>
                <circle
                  cx={pad + i * pw}
                  cy={scaleY(p.winA)}
                  r="3"
                  fill="#11EBCF"
                />
                <circle
                  cx={pad + i * pw}
                  cy={scaleY(p.winB)}
                  r="3"
                  fill="#FFD700"
                />
                {i % Math.max(1, Math.floor(winHistory.length / 8)) === 0 && (
                  <text
                    x={pad + i * pw}
                    y={h - 5}
                    fill="#555"
                    fontSize="8"
                    textAnchor="middle"
                  >
                    {p.over}
                  </text>
                )}
              </g>
            ))}
          </svg>
          <div className="flex justify-center gap-6 mt-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded bg-aurora-teal inline-block" />
              <span className="text-gray-400 font-bold">{teamA}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded bg-metallic-gold inline-block" />
              <span className="text-gray-400 font-bold">{teamB}</span>
            </span>
          </div>
        </div>
        {/* Momentum: runs scored per over as bar chart */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
            Run Flow Per Ball
          </h4>
          <div className="flex items-end gap-1 h-24 overflow-x-auto custom-scrollbar pb-2">
            {history
              .filter(
                (p) =>
                  p.over_ball &&
                  !["STAT", "UPDATE", "Live", "Finished"].includes(p.over_ball),
              )
              .slice()
              .reverse()
              .map((p, i) => {
                const runs = parseInt(p.runs_scored, 10) || 0;
                const isW = p.runs_scored?.toLowerCase().includes("w");
                const barH = isW ? 90 : Math.max(8, (runs / 6) * 90);
                const color = isW
                  ? "bg-red-500"
                  : runs >= 6
                    ? "bg-aurora-teal"
                    : runs >= 4
                      ? "bg-metallic-gold"
                      : runs > 0
                        ? "bg-white/30"
                        : "bg-white/10";
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-1 min-w-[14px]"
                  >
                    <div
                      className={`w-3 rounded-t ${color}`}
                      style={{ height: `${barH}%` }}
                    />
                    <span className="text-[7px] text-gray-600">
                      {p.over_ball}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Header Card */}
      <div className="bg-[#111111] border border-white/10 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <Activity size={96} className="text-aurora-teal" />
        </div>
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-metallic-gold uppercase tracking-[0.2em]">
                {match.source} Live Feed
              </span>
              <div className="size-1 rounded-full bg-white/20" />
              <div className="flex items-center gap-2">
                <span
                  className={`flex size-2 relative ${connected ? "visible" : "hidden"}`}
                >
                  <span className="animate-ping absolute inline-flex size-full rounded-full bg-aurora-teal opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-aurora-teal"></span>
                </span>
                <span
                  className={`text-[8px] font-black uppercase tracking-widest ${connected ? "text-aurora-teal" : "text-gray-500 animate-pulse"}`}
                >
                  {connected ? "STREAMING" : "POLLING FALLBACK"}
                </span>
              </div>
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-black italic text-white leading-tight uppercase tracking-tighter">
            {match.title}
          </h2>
          <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                Match State
              </div>
              <div className={`text-2xl font-black italic ${statusColor}`}>
                {currentScore}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                Universal Match ID
              </div>
              <div className="text-xs font-mono text-gray-400 font-bold">
                {match.match_id}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Win Prediction Bar */}
      {latestWin && (
        <div className="bg-[#111111] border border-white/10 rounded-2xl p-5 space-y-3">
          <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
            Win Probability
          </div>
          <div className="flex justify-between text-sm font-black">
            <span className="text-aurora-teal">
              {latestWin.teamA}: {latestWin.winA.toFixed(1)}%
            </span>
            <span className="text-metallic-gold">
              {latestWin.teamB}: {latestWin.winB.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-[#11EBCF] to-[#11EBCF]/60 transition-all duration-500 flex-none"
              style={{ width: `${latestWin.winA}%` }}
            />
            <div
              className="h-full bg-gradient-to-l from-metallic-gold to-metallic-gold/60 transition-all duration-500 flex-none"
              style={{ width: `${latestWin.winB}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-[#111111] border border-white/10 p-1 rounded-2xl">
        {(["commentary", "scorecard", "graphs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setLiveTab(tab)}
            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${liveTab === tab ? "bg-aurora-teal text-black" : "text-gray-400 hover:text-white"}`}
          >
            {tab === "commentary"
              ? "💬 Commentary"
              : tab === "scorecard"
                ? "📊 Scorecard"
                : "📈 Graphs"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {liveTab === "commentary" && (
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {history.length > 0 ? (
              history.map((packet, idx) => {
                const isWicket = packet.runs_scored
                  ?.toLowerCase()
                  .includes("w");
                const isInfo =
                  packet.runs_scored === "INFO" ||
                  packet.runs_scored === "STAT" ||
                  packet.flavor?.includes("update") ||
                  packet.flavor?.includes("stat");
                const overLabel = packet.over_ball?.startsWith("UPDATE_")
                  ? "UPDATE"
                  : packet.over_ball === "STAT"
                    ? "STAT"
                    : `OV ${packet.over_ball}`;
                const runLabel = isInfo
                  ? packet.runs_scored
                  : isWicket
                    ? "WKT"
                    : packet.runs_scored === "-"
                      ? "DOT"
                      : `${packet.runs_scored} RUNS`;
                let runStyle = "bg-white/5 border-white/10 text-white";
                if (isWicket)
                  runStyle = "bg-red-500/20 border-red-500/30 text-red-400";
                else if (isInfo)
                  runStyle = "bg-blue-500/20 border-blue-500/30 text-blue-300";
                else if (packet.runs_scored === "4")
                  runStyle =
                    "bg-metallic-gold/20 border-metallic-gold/30 text-metallic-gold";
                else if (packet.runs_scored === "6")
                  runStyle =
                    "bg-aurora-teal/20 border-aurora-teal/30 text-aurora-teal";
                return (
                  <div
                    key={packet.event_key || `${packet.over_ball}-${idx}`}
                    className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row gap-4 items-start"
                  >
                    <div className="flex items-center gap-3 min-w-[120px]">
                      <div className="text-xs font-black text-gray-400 font-mono">
                        {overLabel}
                      </div>
                      <div
                        className={`px-2.5 py-1 rounded-lg border text-xs font-black uppercase tracking-wider ${runStyle}`}
                      >
                        {runLabel}
                      </div>
                    </div>
                    <div className="flex-1 text-sm text-gray-300 font-medium leading-relaxed">
                      {packet.commentary}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center text-gray-500 italic bg-white/[0.01] border border-white/5 rounded-3xl">
                Waiting for commentary updates...
              </div>
            )}
          </div>
        )}
        {liveTab === "scorecard" && renderScorecard()}
        {liveTab === "graphs" && renderGraph()}
      </div>
    </motion.div>
  );
};

/**
 * Renders a matches section with live/archived tournament navigation and detail views.
 * @example
 * MatchesSection({ onBackToHome: () => console.log("Back to home") })
 * undefined
 * @param {{ onBackToHome?: () => void }} props - Component props containing an optional callback to return to the home view.
 * @returns {JSX.Element} The matches section UI with selectable lists and detail panels.
 **/
export const MatchesSection: React.FC<{ onBackToHome?: () => void }> = ({
  onBackToHome,
}) => {
  const [view, setView] = useState<
    "tournaments" | "matches" | "detail" | "live_detail"
  >("tournaments");
  const [mode, setMode] = useState<"live" | "archive">("live");
  const [selectedTournament, setSelectedTournament] =
    useState<Tournament | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [selectedLiveMatch, setSelectedLiveMatch] = useState<LiveMatch | null>(
    null,
  );

  /**
   * Navigates back to the previous view or triggers the home callback depending on the current view.
   * @example
   * handleBack()
   * undefined
   * @param {void} - This function does not accept any arguments.
   * @returns {void} Does not return a value.
   */
  const handleBack = () => {
    if (view === "live_detail") {
      setView("tournaments");
      setSelectedLiveMatch(null);
    } else if (view === "detail") {
      setView("matches");
    } else if (view === "matches") {
      setView("tournaments");
    } else if (view === "tournaments") {
      if (onBackToHome) onBackToHome();
    }
  };

  return (
    <div className="relative overflow-hidden min-h-[400px]">
      <div className="mb-6 flex justify-between items-center">
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={handleBack}
          className="flex items-center justify-center size-10 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-metallic-gold group shadow-lg"
        >
          <ArrowLeft
            size={20}
            className="group-hover:-translate-x-1 transition-transform"
          />
        </motion.button>

        {view === "tournaments" && (
          <div className="flex bg-[#111111] border border-white/10 p-1 rounded-2xl">
            <button
              onClick={() => setMode("live")}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                mode === "live"
                  ? "bg-aurora-teal text-black font-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Live Matches
            </button>
            <button
              onClick={() => setMode("archive")}
              className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                mode === "archive"
                  ? "bg-aurora-teal text-black font-black"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Archive
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {view === "tournaments" && mode === "live" && (
          <LiveMatchesList
            key="live-matches"
            onSelect={(m) => {
              setSelectedLiveMatch(m);
              setView("live_detail");
            }}
          />
        )}
        {view === "tournaments" && mode === "archive" && (
          <TournamentsList
            key="tournaments"
            onSelect={(t) => {
              setSelectedTournament(t);
              setView("matches");
            }}
          />
        )}
        {view === "matches" && selectedTournament && (
          <TournamentMatchesList
            key="matches"
            tournament={selectedTournament}
            onBack={() => setView("tournaments")}
            onSelectMatch={(id) => {
              setSelectedMatchId(id);
              setView("detail");
            }}
          />
        )}
        {view === "detail" && selectedMatchId && (
          <MatchDetail
            key="detail"
            matchId={selectedMatchId}
            onBack={() => setView("matches")}
          />
        )}
        {view === "live_detail" && selectedLiveMatch && (
          <LiveMatchDetail
            key="live-detail"
            match={selectedLiveMatch}
            onBack={handleBack}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
