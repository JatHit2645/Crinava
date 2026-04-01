import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, MapPin, Calendar, ArrowLeft, Loader2, ChevronRight, Star, Info, Activity, Coins, Search, Filter, SlidersHorizontal, ChevronDown, Check, Zap, Gavel, BookOpen, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface Tournament {
  event_name: string;
  season: string;
  start_date?: string;
  end_date?: string;
  match_count?: number;
}

interface MatchData {
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
}

// --- Helper to parse Cricsheet JSON into a readable scorecard ---
const parseScorecard = (rawInfo: any) => {
  if (typeof rawInfo === 'string') {
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
    inningsList = Object.values(rawInfo.innings).map((inn: any) => Object.values(inn)[0]);
  }

  return inningsList?.map((inning: any) => {
    const team = inning.team || 'Unknown Team';
    const batters: Record<string, any> = {};
    const bowlers: Record<string, any> = {};
    let totalRuns = 0;
    let totalWickets = 0;
    let totalLegalBalls = 0;
    let extras = { b: 0, lb: 0, w: 0, nb: 0, p: 0, total: 0 };

    let deliveries: any[] = [];
    if (inning.overs) {
      inning.overs.forEach((over: any) => {
        if (over.deliveries) deliveries.push(...over.deliveries);
      });
    } else if (inning.deliveries) {
      inning.deliveries.forEach((dObj: any) => {
        const key = Object.keys(dObj)[0];
        deliveries.push(dObj[key]);
      });
    }

    deliveries.forEach((d: any) => {
      // Batting
      const batter = d.batter || d.batsman;
      if (!batters[batter]) batters[batter] = { name: batter, runs: 0, balls: 0, fours: 0, sixes: 0, dismissal: 'not out' };

      const runsBatter = d.runs ? d.runs.batter || d.runs.batsman || 0 : 0;
      batters[batter].runs += runsBatter;

      let isWide = d.extras && d.extras.wides;
      if (!isWide) batters[batter].balls += 1;
      if (runsBatter === 4) batters[batter].fours += 1;
      if (runsBatter === 6) batters[batter].sixes += 1;

      // Bowling
      const bowler = d.bowler;
      if (!bowlers[bowler]) bowlers[bowler] = { name: bowler, balls: 0, runs: 0, wickets: 0, dots: 0 };

      let isLegalBall = true;
      let bowlerRuns = runsBatter;

      if (d.extras) {
        if (d.extras.wides) { isLegalBall = false; bowlerRuns += d.extras.wides; extras.w += d.extras.wides; extras.total += d.extras.wides; }
        if (d.extras.noballs) { isLegalBall = false; bowlerRuns += d.extras.noballs; extras.nb += d.extras.noballs; extras.total += d.extras.noballs; }
        if (d.extras.byes) { extras.b += d.extras.byes; extras.total += d.extras.byes; }
        if (d.extras.legbyes) { extras.lb += d.extras.legbyes; extras.total += d.extras.legbyes; }
        if (d.extras.penalty) { extras.p += d.extras.penalty; extras.total += d.extras.penalty; }
      }

      if (isLegalBall) {
        bowlers[bowler].balls += 1;
        totalLegalBalls += 1;
      }
      if (runsBatter === 0 && !d.extras) {
        bowlers[bowler].dots += 1;
      }
      bowlers[bowler].runs += bowlerRuns;
      totalRuns += d.runs ? d.runs.total || 0 : 0;

      // Wickets
      if (d.wickets) {
        d.wickets.forEach((w: any) => {
          totalWickets += 1;
          const playerOut = w.player_out;
          if (batters[playerOut]) {
            let dismissal = w.kind;
            if (w.kind === 'bowled') dismissal = `b ${bowler}`;
            else if (w.kind === 'caught') dismissal = `c ${w.fielders ? w.fielders?.map((f:any)=>f.name).join(', ') : 'sub'} b ${bowler}`;
            else if (w.kind === 'lbw') dismissal = `lbw b ${bowler}`;
            else if (w.kind === 'run out') dismissal = `run out`;
            else if (w.kind === 'stumped') dismissal = `st ${w.fielders ? w.fielders?.map((f:any)=>f.name).join(', ') : 'sub'} b ${bowler}`;
            else if (w.kind === 'caught and bowled') dismissal = `c & b ${bowler}`;
            batters[playerOut].dismissal = dismissal;
          }
          if (['bowled', 'caught', 'lbw', 'stumped', 'caught and bowled', 'hit wicket'].includes(w.kind)) {
            bowlers[bowler].wickets += 1;
          }
        });
      }
    });

    const teamPlayers = players[team] || [];
    const battedPlayers = Object.keys(batters);
    const didNotBat = teamPlayers.filter((p: string) => !battedPlayers.includes(p));

    return {
      team,
      totalRuns,
      totalWickets,
      overs: `${Math.floor(totalLegalBalls / 6)}.${totalLegalBalls % 6}`,
      batters: Object.values(batters),
      bowlers: Object.values(bowlers),
      extras,
      didNotBat
    };
  });
};

export const TournamentsList: React.FC<{ onSelect: (t: Tournament) => void }> = ({ onSelect }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc'>('newest');
  const [leaguesOnly, setLeaguesOnly] = useState(false);
  const [yearRange, setYearRange] = useState<[number, number]>([1970, 2026]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchTournaments = async () => {
      setLoading(true);
      
      // Fetch more matches to ensure we get all series
      // Selecting only necessary fields to reduce payload size
      const { data: matchData, error } = await supabase
        .from('matches')
        .select('event_name, season, match_date')
        .order('match_date', { ascending: false })
        .limit(100000);
      
      if (error) console.error("Error fetching tournaments:", error);

      const seriesMap = new Map<string, Tournament>();
      if (matchData) {
        matchData.forEach(row => {
          if (!row.event_name) return;
          const key = `${row.event_name}-${row.season || ''}`;
          if (!seriesMap.has(key)) {
            seriesMap.set(key, {
              event_name: row.event_name,
              season: row.season,
              start_date: row.match_date,
              match_count: 0
            });
          }
          const t = seriesMap.get(key)!;
          t.match_count = (t.match_count || 0) + 1;
          // Ensure start_date is the latest date for sorting
          if (row.match_date && (!t.start_date || row.match_date > t.start_date)) {
            t.start_date = row.match_date;
          }
        });
      }

      let uniqueSeries = Array.from(seriesMap.values());

      const getSortDate = (t: Tournament) => {
        if (t.start_date) return t.start_date;
        
        // Fallback to extracting year from name/season
        const allText = `${t.event_name} ${t.season || ''}`;
        const yearMatch = allText.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) return `${yearMatch[0]}-12-31`;
        
        return '1900-01-01';
      };

      const getSortName = (t: Tournament) => (t.event_name || '').toLowerCase();

      const applySorting = (list: Tournament[]) => {
        const sorted = [...list];
        if (sortBy === 'newest') {
          sorted.sort((a, b) => {
            const dateA = getSortDate(a);
            const dateB = getSortDate(b);
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            return getSortName(a).localeCompare(getSortName(b));
          });
        } else if (sortBy === 'oldest') {
          sorted.sort((a, b) => {
            const dateA = getSortDate(a);
            const dateB = getSortDate(b);
            if (dateA !== dateB) return dateA.localeCompare(dateB);
            return getSortName(a).localeCompare(getSortName(b));
          });
        } else if (sortBy === 'name_asc') {
          sorted.sort((a, b) => getSortName(a).localeCompare(getSortName(b)));
        } else if (sortBy === 'name_desc') {
          sorted.sort((a, b) => getSortName(b).localeCompare(getSortName(a)));
        }
        return sorted;
      };

      // Apply filters client-side
      let filtered = uniqueSeries;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(t => t.event_name.toLowerCase().includes(q));
      }
      if (leaguesOnly) {
        const leagueKeywords = ['League', 'IPL', 'BBL', 'PSL', 'WPL', 'SA20', 'CPL', 'BPL', 'World Cup'];
        filtered = filtered.filter(t => leagueKeywords.some(k => t.event_name.toLowerCase().includes(k.toLowerCase())));
      }
      filtered = filtered.filter(t => {
        let year = NaN;
        const yearMatch = (t.start_date || t.season || '').toString().match(/\b(19|20)\d{2}\b/);
        if (yearMatch) year = parseInt(yearMatch[0]);
        if (isNaN(year)) return true;
        return year >= yearRange[0] && year <= yearRange[1];
      });

      setTournaments(applySorting(filtered));
      setLoading(false);
    };
    
    const debounceTimer = setTimeout(fetchTournaments, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, sortBy, leaguesOnly, yearRange]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center border-b border-aurora-600 pb-6">
          <div className="space-y-1">
            <h2 className="text-4xl font-display font-bold text-text-primary uppercase tracking-tight">Global Series</h2>
            <p className="text-text-body font-mono text-[10px] uppercase tracking-widest">Technical Database Sync</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-win-green uppercase tracking-widest mb-1">Total Indexed</div>
            <div className="text-xl font-mono font-bold text-text-primary">{tournaments.length}</div>
          </div>
        </div>
        
        {/* Search and Filter Bar */}
        <div className="flex gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-win-green transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="SEARCH SERIES ARCHIVE..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass-card pl-12 pr-4 py-4 text-xs font-mono text-text-primary placeholder:text-muted focus:outline-none focus:border-win-green/50 transition-all uppercase tracking-widest"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-6 rounded-md border transition-all flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest ${showFilters ? 'bg-win-green/10 border-win-green text-win-green' : 'bg-aurora-dark border-aurora-600 text-text-body hover:border-muted'}`}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden md:inline">Filters</span>
          </button>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-aurora-800 border border-aurora-600 rounded-2xl space-y-6">
                {/* Sort Dropdown */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Sort By</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'newest', label: 'Newest First' },
                      { id: 'oldest', label: 'Oldest First' },
                      { id: 'name_asc', label: 'Name (A-Z)' },
                      { id: 'name_desc', label: 'Name (Z-A)' }
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setSortBy(option.id as any)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-between ${sortBy === option.id ? 'bg-aurora-300/10 border-aurora-300 text-aurora-300' : 'bg-aurora-700/50 border-aurora-600/50 text-text-body hover:border-aurora-600'}`}
                      >
                        {option.label}
                        {sortBy === option.id && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Leagues Toggle */}
                <div className="flex items-center justify-between p-3 bg-aurora-700/50 rounded-xl border border-aurora-600/50">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-text-primary">Major Leagues Only</div>
                    <div className="text-[9px] text-text-muted uppercase tracking-widest">IPL, BBL, Leagues</div>
                  </div>
                  <button 
                    onClick={() => setLeaguesOnly(!leaguesOnly)}
                    className={`w-10 h-5 rounded-full relative transition-all ${leaguesOnly ? 'bg-aurora-300' : 'bg-aurora-600'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-text-primary rounded-full transition-all ${leaguesOnly ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                {/* Year Range Slider */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Year Range</label>
                    <span className="text-xs font-bold text-aurora-300">{yearRange[0]} - {yearRange[1]}</span>
                  </div>
                  <div className="px-2">
                    <div className="relative h-2 bg-aurora-700/50 rounded-full flex items-center">
                      <div 
                        className="absolute h-full bg-aurora-300/50 rounded-full"
                        style={{ 
                          left: `${((yearRange[0] - 1970) / (2026 - 1970)) * 100}%`,
                          width: `${((yearRange[1] - yearRange[0]) / (2026 - 1970)) * 100}%`
                        }}
                      />
                      <input 
                        type="range" 
                        min="1970" 
                        max="2026" 
                        value={yearRange[0]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setYearRange([Math.min(val, yearRange[1]), yearRange[1]]);
                        }}
                        className="absolute w-full h-2 bg-transparent appearance-none pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-aurora-300 [&::-webkit-slider-thumb]:rounded-full"
                      />
                      <input 
                        type="range" 
                        min="1970" 
                        max="2026" 
                        value={yearRange[1]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setYearRange([yearRange[0], Math.max(val, yearRange[0])]);
                        }}
                        className="absolute w-full h-2 bg-transparent appearance-none pointer-events-none z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-text-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-aurora-300 [&::-webkit-slider-thumb]:rounded-full"
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
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="animate-spin text-aurora-300" size={32} />
          <p className="text-text-body animate-pulse">Filtering series...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tournaments?.map((t, idx) => (
            <div 
              key={idx} 
              onClick={() => onSelect(t)}
              className="p-8 glass-card cursor-pointer hover:bg-aurora-700/50 hover:border-win-green/30 transition-all group flex justify-between items-center"
            >
              <div className="space-y-2">
                <h3 className="text-2xl font-display font-bold text-text-primary uppercase tracking-tight group-hover:text-win-green transition-colors">{t.event_name}</h3>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-mono font-bold text-win-green uppercase tracking-widest">{t.season}</span>
                  {t.match_count && (
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-muted" />
                      <span className="text-[10px] font-mono text-text-body uppercase tracking-widest">
                        {t.match_count} Matches
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-3 bg-aurora-950 border border-aurora-600 rounded-md text-text-body group-hover:text-win-green transition-colors">
                <ChevronRight size={16} />
              </div>
            </div>
          ))}
          {tournaments.length === 0 && (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="p-4 bg-aurora-700/50 rounded-full w-fit mx-auto">
                <Search size={32} className="text-text-muted" />
              </div>
              <p className="text-text-muted italic">No series found matching your filters.</p>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setLeaguesOnly(false);
                  setYearRange([2001, 2026]);
                }}
                className="text-aurora-300 text-xs font-black uppercase tracking-widest hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

const TournamentMatchesList: React.FC<{ tournament: Tournament; onBack: () => void; onSelectMatch: (id: number) => void }> = ({ tournament, onBack, onSelectMatch }) => {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'matches' | 'predict' | 'verdict' | 'momentum' | 'playingXI' | 'stories' | 'stats'>('matches');
  const [activeStatTab, setActiveStatTab] = useState<'runs' | 'wickets' | 'sr' | 'avg' | 'econ' | 'mvp' | 'highestScore' | 'centuries' | 'fours' | 'sixes' | 'fiveWicketHauls' | 'bowlingAvg' | 'bowlingSR'>('mvp');
  const [aiContent, setAiContent] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      
      // Fetch matches for the tournament
      let query = supabase
        .from('matches')
        .select('match_id, team_1, team_2, match_date, venue, outcome_result, raw_info')
        .eq('event_name', tournament.event_name);
      
      if (tournament.season) {
        query = query.eq('season', tournament.season);
      } else {
        query = query.is('season', null);
      }

      const { data, error } = await query
        .order('match_date', { ascending: false })
        .limit(3000); // Limit to 3000 for performance
      
      if (error || !data || data.length === 0) {
        if (error) console.error("Error fetching matches:", error);
        setMatches([]);
        setLoading(false);
        return;
      }

      setMatches(data);

      // Calculate Tournament Stats
      const playerStats: Record<string, any> = {};
      
      data.forEach(match => {
        const scorecard = parseScorecard(match.raw_info);
        scorecard.forEach(inning => {
          inning.batters?.forEach((b: any) => {
            if (!playerStats[b.name]) playerStats[b.name] = { name: b.name, runs: 0, balls: 0, dismissals: 0, wickets: 0, bowlRuns: 0, bowlBalls: 0, impact: 0, sixes: 0, fours: 0, highestScore: 0, centuries: 0, fiveWicketHauls: 0 };
            playerStats[b.name].runs += b.runs || 0;
            playerStats[b.name].balls += b.balls || 0;
            playerStats[b.name].sixes += b.sixes || 0;
            playerStats[b.name].fours += b.fours || 0;
            if ((b.runs || 0) > playerStats[b.name].highestScore) playerStats[b.name].highestScore = b.runs || 0;
            if ((b.runs || 0) >= 100) playerStats[b.name].centuries += 1;
            if (b.dismissal && b.dismissal !== 'not out') playerStats[b.name].dismissals += 1;
            playerStats[b.name].impact += (b.runs || 0) + ((b.sixes || 0) * 2) - ((b.balls || 0) * 0.25);
          });
          inning.bowlers?.forEach((b: any) => {
            if (!playerStats[b.name]) playerStats[b.name] = { name: b.name, runs: 0, balls: 0, dismissals: 0, wickets: 0, bowlRuns: 0, bowlBalls: 0, impact: 0, sixes: 0, fours: 0, highestScore: 0, centuries: 0, fiveWicketHauls: 0 };
            playerStats[b.name].wickets += b.wickets || 0;
            playerStats[b.name].bowlRuns += b.runs || 0;
            playerStats[b.name].bowlBalls += b.balls || 0;
            if ((b.wickets || 0) >= 5) playerStats[b.name].fiveWicketHauls += 1;
            playerStats[b.name].impact += ((b.wickets || 0) * 25) + ((b.dots || 0) * 1) - ((b.runs || 0) * 0.5);
          });
        });
      });

      const players = Object.values(playerStats);
      
      setStats({
        runs: [...players].sort((a, b) => b.runs - a.runs).slice(0, 5),
        wickets: [...players].sort((a, b) => b.wickets - a.wickets).slice(0, 5),
        highestScore: [...players].sort((a, b) => b.highestScore - a.highestScore).slice(0, 5),
        mostCenturies: [...players].sort((a, b) => b.centuries - a.centuries).slice(0, 5),
        mostFours: [...players].sort((a, b) => b.fours - a.fours).slice(0, 5),
        mostSixes: [...players].sort((a, b) => b.sixes - a.sixes).slice(0, 5),
        most5WicketHauls: [...players].sort((a, b) => b.fiveWicketHauls - a.fiveWicketHauls).slice(0, 5),
        bowlingAvg: [...players].filter(p => p.wickets > 0).sort((a, b) => (a.bowlRuns / a.wickets) - (b.bowlRuns / b.wickets)).slice(0, 5),
        bowlingSR: [...players].filter(p => p.wickets > 0).sort((a, b) => (a.bowlBalls / a.wickets) - (b.bowlBalls / b.wickets)).slice(0, 5),
        highestSR: [...players].filter(p => p.runs >= 50).sort((a, b) => (b.runs / (b.balls || 1)) - (a.runs / (a.balls || 1))).slice(0, 5),
        highestAvg: [...players].filter(p => p.runs >= 50).sort((a, b) => {
          const avgA = a.dismissals === 0 ? a.runs : a.runs / a.dismissals;
          const avgB = b.dismissals === 0 ? b.runs : b.runs / b.dismissals;
          return avgB - avgA;
        }).slice(0, 5),
        bestEcon: [...players].filter(p => p.bowlBalls >= 60).sort((a, b) => (a.bowlRuns / (a.bowlBalls || 1)) - (b.bowlRuns / (b.bowlBalls || 1))).slice(0, 5),
        mvp: [...players].sort((a, b) => b.impact - a.impact).slice(0, 5)
      });

      setLoading(false);
    };
    fetchMatches();
  }, [tournament]);

  useEffect(() => {
    if (['predict', 'verdict', 'momentum', 'playingXI', 'stories'].includes(activeTab) && !aiContent[activeTab]) {
      const fetchAiContent = async () => {
        setAiLoading(true);
        try {
          let prompt = "";
          if (activeTab === 'predict') prompt = `Predict the outcome and key trends for the tournament: ${tournament.event_name} ${tournament.season}. Who are the favorites and why?`;
          if (activeTab === 'verdict') prompt = `Provide a data-driven verdict on the ${tournament.event_name} ${tournament.season}. What was the defining moment or factor?`;
          if (activeTab === 'momentum') prompt = `Analyze the momentum shifts throughout the ${tournament.event_name} ${tournament.season}. Which team dominated which phase?`;
          if (activeTab === 'playingXI') prompt = `Select the Best XI of the tournament for ${tournament.event_name} ${tournament.season} based on performance.`;
          if (activeTab === 'stories') prompt = `Tell 3 compelling human-interest stories or player trajectories from the ${tournament.event_name} ${tournament.season}.`;

          const response = await fetch('/api/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: [
                { role: 'system', content: 'You are a cricket expert providing tournament insights.' },
                { role: 'user', content: prompt }
              ]
            })
          });

          if (!response.ok) throw new Error("AI request failed");
          const data = await response.json();
          
          setAiContent(prev => ({ ...prev, [activeTab]: data.text || "No content generated." }));
        } catch (err) {
          console.error("AI fetch error:", err);
          setAiContent(prev => ({ ...prev, [activeTab]: "Failed to generate AI insights. Please try again." }));
        }
        setAiLoading(false);
      };
      fetchAiContent();
    }
  }, [activeTab, tournament]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-aurora-300" size={32} /></div>;

  const renderStatList = (list: any[], valueKey: string, formatFn?: (p: any) => string | number) => (
    <div className="space-y-2 mt-4">
      {list?.map((p, i) => (
        <div key={i} className="flex justify-between items-center bg-aurora-700/50 p-3 rounded-lg border border-aurora-600/50">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-text-muted font-bold w-4 shrink-0">{i + 1}</span>
            <span className="text-text-primary font-medium truncate pr-2">{p.name}</span>
          </div>
          <span className="font-black text-aurora-300 shrink-0">
            {formatFn ? formatFn(p) : p[valueKey]}
          </span>
        </div>
      ))}
      {list?.length === 0 && <div className="text-text-muted text-sm text-center py-4">Not enough data</div>}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="flex justify-between items-end border-b border-aurora-600 pb-6">
        <div className="space-y-1">
          <h2 className="text-4xl font-display font-bold text-text-primary uppercase tracking-tight">{tournament.event_name}</h2>
          <p className="text-win-green font-mono text-[10px] uppercase tracking-widest">{tournament.season}</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono text-text-body uppercase tracking-widest mb-1">Match Count</div>
          <div className="text-xl font-mono font-bold text-text-primary">{matches.length}</div>
        </div>
      </div>

      <div className="overflow-x-auto pb-4 scrollbar-hide">
        <div className="flex gap-2 p-1 glass-card min-w-max">
          {[
            { id: 'matches', label: 'Matches' },
            { id: 'stats', label: 'Stats' },
            { id: 'predict', label: 'Predict' },
            { id: 'verdict', label: 'Verdict' },
            { id: 'momentum', label: 'Momentum' },
            { id: 'playingXI', label: 'Playing XI' },
            { id: 'stories', label: 'Stories' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'tab-active' : 'tab-inactive'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Tournament Stats Section */}
      {activeTab === 'stats' && stats && (
        <div className="glass-card p-8 space-y-8">
          <div className="flex items-center justify-between border-b border-aurora-600 pb-6">
            <h3 className="text-2xl font-display font-bold text-text-primary uppercase tracking-tight flex items-center gap-3">
              <Trophy size={24} className="text-gold-base" /> Tournament Leaders
            </h3>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'mvp', label: 'CRINAVA MVP' },
              { id: 'runs', label: 'MOST RUNS' },
              { id: 'wickets', label: 'MOST WICKETS' },
              { id: 'highestScore', label: 'HIGHEST SCORE' },
              { id: 'centuries', label: 'MOST CENTURIES' },
              { id: 'fours', label: 'MOST FOURS' },
              { id: 'sixes', label: 'MOST SIXES' },
              { id: 'fiveWicketHauls', label: 'MOST 5-W' },
              { id: 'bowlingAvg', label: 'BOWL AVG' },
              { id: 'bowlingSR', label: 'BOWL SR' },
              { id: 'sr', label: 'HIGHEST SR' },
              { id: 'avg', label: 'HIGHEST AVG' },
              { id: 'econ', label: 'BEST ECON' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveStatTab(tab.id as any)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${activeStatTab === tab.id ? 'filter-chip filter-chip-active' : 'filter-chip'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {activeStatTab === 'mvp' && renderStatList(stats.mvp, 'impact', (p) => p.impact.toFixed(1))}
            {activeStatTab === 'runs' && renderStatList(stats.runs, 'runs')}
            {activeStatTab === 'wickets' && renderStatList(stats.wickets, 'wickets')}
            {activeStatTab === 'highestScore' && renderStatList(stats.highestScore, 'highestScore')}
            {activeStatTab === 'centuries' && renderStatList(stats.mostCenturies, 'centuries')}
            {activeStatTab === 'fours' && renderStatList(stats.mostFours, 'fours')}
            {activeStatTab === 'sixes' && renderStatList(stats.mostSixes, 'sixes')}
            {activeStatTab === 'fiveWicketHauls' && renderStatList(stats.most5WicketHauls, 'fiveWicketHauls')}
            {activeStatTab === 'bowlingAvg' && renderStatList(stats.bowlingAvg, 'bowlRuns', (p) => (p.bowlRuns / p.wickets).toFixed(1))}
            {activeStatTab === 'bowlingSR' && renderStatList(stats.bowlingSR, 'bowlBalls', (p) => (p.bowlBalls / p.wickets).toFixed(1))}
            {activeStatTab === 'sr' && renderStatList(stats.highestSR, 'runs', (p) => ((p.runs / p.balls) * 100).toFixed(1))}
            {activeStatTab === 'avg' && renderStatList(stats.highestAvg, 'runs', (p) => (p.dismissals === 0 ? p.runs.toFixed(1) : (p.runs / p.dismissals).toFixed(1)))}
            {activeStatTab === 'econ' && renderStatList(stats.bestEcon, 'bowlRuns', (p) => ((p.bowlRuns / p.bowlBalls) * 6).toFixed(1))}
          </div>
        </div>
      )}

      {activeTab === 'matches' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-aurora-600 pb-6">
            <h3 className="text-2xl font-display font-bold text-text-primary uppercase tracking-tight">Fixture Archive</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {matches?.map((match) => (
              <div 
                key={match.match_id} 
                onClick={() => onSelectMatch(match.match_id)}
                className="p-8 glass-card cursor-pointer hover:bg-aurora-700/50 hover:border-win-green/30 transition-all group"
              >
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-mono font-bold text-text-body uppercase tracking-widest">{match.match_date}</span>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted uppercase tracking-widest">
                    <MapPin size={10}/> 
                    <span>{match.raw_info?.info?.venue || match.venue}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 items-center gap-4 py-6 border-y border-aurora-600">
                  <div className="text-xl font-display font-bold text-text-primary uppercase text-center">{match.team_1}</div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-[10px] font-mono font-bold text-muted uppercase tracking-widest">VS</div>
                    <div className="w-px h-8 bg-leg" />
                  </div>
                  <div className="text-xl font-display font-bold text-text-primary uppercase text-center">{match.team_2}</div>
                </div>
                <div className="mt-6 text-center">
                  <span className="text-[10px] font-mono font-bold text-win-green uppercase tracking-[0.2em]">
                    {match.outcome_result || (match.raw_info?.info?.outcome?.by?.runs ? `${match.raw_info.info.outcome.winner} won by ${match.raw_info.info.outcome.by.runs} runs` : match.raw_info?.info?.outcome?.by?.wickets ? `${match.raw_info.info.outcome.winner} won by ${match.raw_info.info.outcome.by.wickets} wickets` : 'Match Result Unavailable')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {['predict', 'verdict', 'momentum', 'playingXI', 'stories'].includes(activeTab) && (
        <div className="glass-card p-8 lg:p-12 space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5">
            {activeTab === 'predict' && <Zap size={120} />}
            {activeTab === 'verdict' && <Gavel size={120} />}
            {activeTab === 'momentum' && <Activity size={120} />}
            {activeTab === 'playingXI' && <Users size={120} />}
            {activeTab === 'stories' && <BookOpen size={120} />}
          </div>

          <div className="relative z-10 space-y-8">
            <h3 className="text-4xl font-display font-bold text-text-primary uppercase tracking-tight flex items-center gap-4">
              {activeTab === 'predict' && <Zap className="text-win-green" />}
              {activeTab === 'verdict' && <Gavel className="text-aurora-300" />}
              {activeTab === 'momentum' && <Activity className="text-win-green" />}
              {activeTab === 'playingXI' && <Users className="text-gold-base" />}
              {activeTab === 'stories' && <BookOpen className="text-win-green" />}
              {activeTab.replace(/([A-Z])/g, ' $1').trim()}
            </h3>
            
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-6">
                <div className="w-12 h-12 border-2 border-win-green/30 border-t-pitch-green rounded-full animate-spin" />
                <p className="text-text-body text-[10px] font-mono font-bold uppercase tracking-[0.3em] animate-pulse">Oracle is analyzing tournament telemetry...</p>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none">
                <div className="text-text-body text-sm leading-relaxed whitespace-pre-wrap font-medium border-l-2 border-aurora-500 pl-8 py-2">
                  {aiContent[activeTab]}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const calculateFallbackMvp = (scorecard: any[]) => {
  const players: Record<string, any> = {};

  scorecard.forEach(inning => {
    inning.batters.forEach((b: any) => {
      if (!players[b.name]) players[b.name] = { name: b.name, impact: 0 };
      const batImpact = b.runs + (b.sixes * 2) - (b.balls * 0.25);
      players[b.name].impact += batImpact;
    });
    inning.bowlers.forEach((b: any) => {
      if (!players[b.name]) players[b.name] = { name: b.name, impact: 0 };
      const bowlImpact = (b.wickets * 25) + ((b.dots || 0) * 1) - (b.runs * 0.5);
      players[b.name].impact += bowlImpact;
    });
  });

  return Object.values(players)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5)
    .map(p => ({ player_name: p.name, total_impact_score: p.impact }));
};

const MatchDetail: React.FC<{ matchId: number; onBack: () => void }> = ({ matchId, onBack }) => {
  const [match, setMatch] = useState<MatchData | null>(null);
  const [mvp, setMvp] = useState<any>(null);
  const [showTop5, setShowTop5] = useState(false);
  const [officials, setOfficials] = useState<any>({ field: [], tv: null, referee: null, reserve: null });
  const [loading, setLoading] = useState(true);
  const [activeInning, setActiveInning] = useState(0);

  useEffect(() => {
    setActiveInning(0);
  }, [matchId]);

  useEffect(() => {
    const fetchMatchData = async () => {
      setLoading(true);
      
      // Fetch match
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .eq('match_id', matchId)
        .single();
      
      if (matchData) setMatch(matchData);

      // Fetch MVP - Without join
      const { data: mvpData, error: mvpError } = await supabase
        .from('player_match_impact') 
        .select('player_id, total_impact_score')
        .eq('match_id', matchId)
        .order('total_impact_score', { ascending: false })
        .limit(5);
      
      if (mvpError) {
        console.error("Error fetching MVP:", mvpError);
      } else if (mvpData && mvpData.length > 0) {
        const playerIds = mvpData?.map(m => m.player_id);
        const { data: playersData } = await supabase
          .from('players')
          .select('player_id, player_name')
          .in('player_id', playerIds);
        
        const playerMap: Record<string, string> = {};
        if (playersData) {
          playersData.forEach(p => {
            playerMap[p.player_id] = p.player_name;
          });
        }

        const formattedMvp = mvpData?.map(m => ({
          player_name: playerMap[m.player_id] || 'Unknown Player',
          total_impact_score: m.total_impact_score
        }));
        setMvp(formattedMvp);
      } else if (matchData && matchData.raw_info) {
        // Fallback calculation if DB is empty
        const scorecard = parseScorecard(matchData.raw_info);
        setMvp(calculateFallbackMvp(scorecard));
      }

      // Fetch Officials - Without join
      const { data: umpiresData } = await supabase
        .from('match_umpires')
        .select('role, official_id')
        .eq('match_id', matchId);
      
      let fieldIds: string[] = [];
      let tvId: string | null = null;
      let reserveId: string | null = null;
      if (umpiresData) {
        umpiresData.forEach(u => {
          if (u.role === 'field') fieldIds.push(u.official_id);
          if (u.role === 'tv') tvId = u.official_id;
          if (u.role === 'reserve') reserveId = u.official_id;
        });
      }

      const allOfficialIds = [...fieldIds];
      if (tvId) allOfficialIds.push(tvId);
      if (reserveId) allOfficialIds.push(reserveId);
      if (matchData?.match_referee_id) allOfficialIds.push(matchData.match_referee_id);

      let officialsMap: Record<string, string> = {};
      if (allOfficialIds.length > 0) {
        const { data: officialsData } = await supabase
          .from('officials')
          .select('official_id, official_name')
          .in('official_id', allOfficialIds);
        
        if (officialsData) {
          officialsData.forEach(o => {
            officialsMap[o.official_id] = o.official_name;
          });
        }
      }

      setOfficials({ 
        field: fieldIds?.map(id => officialsMap[id]).filter(Boolean), 
        tv: tvId ? officialsMap[tvId] : null, 
        referee: matchData?.match_referee_id ? officialsMap[matchData.match_referee_id] : null, 
        reserve: reserveId ? officialsMap[reserveId] : null 
      });

      setLoading(false);
    };
    fetchMatchData();
  }, [matchId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-aurora-300" size={32} /></div>;
  if (!match) return <div className="text-text-primary text-center py-20">Match data could not be loaded.</div>;

  const scorecard = parseScorecard(match.raw_info);

  // Helper to get team name from ID
  const getTeamName = (id: string | number | undefined) => {
    if (id == '1') return match.team_1;
    if (id == '2') return match.team_2;
    return id;
  };

  const tossWinner = match.raw_info?.info?.toss?.winner || getTeamName(match.toss_winner_id);
  const tossDecision = match.raw_info?.info?.toss?.decision || match.toss_decision;
  const venue = match.raw_info?.info?.venue || match.venue;
  const city = match.raw_info?.info?.city || match.city;
  const potm = match.player_of_match || (match.raw_info?.info?.player_of_match ? match.raw_info.info.player_of_match.join(', ') : 'N/A');
  const matchResult = match.outcome_result || (match.raw_info?.info?.outcome?.by?.runs ? `${match.raw_info.info.outcome.winner} won by ${match.raw_info.info.outcome.by.runs} runs` : match.raw_info?.info?.outcome?.by?.wickets ? `${match.raw_info.info.outcome.winner} won by ${match.raw_info.info.outcome.by.wickets} wickets` : 'Match Result Unavailable');

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 bg-aurora-800 border border-aurora-600 rounded-2xl shadow-2xl space-y-6">
      
      <div className="text-center space-y-2">
        <div className="flex justify-center items-center gap-3">
          <div className="text-xs font-black text-aurora-300 uppercase tracking-widest">{match.match_type}</div>
          <div className="w-1 h-1 rounded-full bg-text-primary/20" />
          <div className="text-xs font-black text-aurora-300 uppercase tracking-widest">
            {match.match_date ? new Date(match.match_date).getFullYear() : (match.season || '').toString().match(/\b(19|20)\d{2}\b/)?.[0] || ''}
          </div>
        </div>
        <h2 className="text-2xl font-black italic text-text-primary">{match.team_1} <span className="text-text-muted text-lg">vs</span> {match.team_2}</h2>
      </div>

      
      {/* Crinava MVP Section */}
      <div className="bg-gradient-to-br from-aurora-500/20 to-transparent border border-aurora-300/30 p-5 rounded-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Star size={64} />
        </div>
        
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-sm font-black text-aurora-300 uppercase tracking-wider flex items-center gap-2">
            <Trophy size={16} /> Crinava Match MVP
          </h3>
          {mvp && mvp.length > 1 && (
            <button 
              onClick={() => setShowTop5(!showTop5)}
              className="text-aurora-300 hover:text-text-primary transition-colors p-1"
            >
              <ChevronRight className={`transform transition-transform ${showTop5 ? 'rotate-90' : ''}`} size={20} />
            </button>
          )}
        </div>
        
        {mvp && mvp.length > 0 ? (
          <div className="space-y-4">
            <div>
              <div className="text-2xl font-black text-text-primary mb-1">{mvp[0].player_name}</div>
              <div className="flex items-end gap-3">
                <div className="text-3xl font-black text-gold-base">{Number(mvp[0].total_impact_score).toFixed(1)} <span className="text-sm text-text-body font-normal">Impact Score</span></div>
              </div>
            </div>

            <AnimatePresence>
              {showTop5 && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden pt-4 border-t border-aurora-600 space-y-2"
                >
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Top 5 Impact Players</div>
                  {mvp?.slice(1)?.map((p: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-aurora-700/50 p-2 rounded">
                      <span className="text-sm text-text-primary font-medium">{p.player_name}</span>
                      <span className="text-sm font-black text-gold-base">{Number(p.total_impact_score).toFixed(1)}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-text-body text-sm italic">MVP calculation pending...</div>
        )}
      </div>

      {/* POTM */}
      <div className="bg-aurora-700/50 p-4 rounded-xl flex items-center gap-4">
        <Trophy className="text-aurora-300" size={24}/>
        <div>
          <div className="text-text-muted text-xs">Player of the Match</div>
          <div className="text-text-primary font-bold">{potm}</div>
        </div>
      </div>

      {/* Match Result Box */}
      <div className="bg-aurora-300/10 border border-aurora-300/30 p-4 rounded-xl text-center">
        <div className="text-aurora-300 font-black text-lg">{matchResult}</div>
      </div>

      {/* Scorecard Section */}
      {scorecard.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-xl font-black italic text-text-primary flex items-center gap-2">
            <Activity size={20} className="text-aurora-300" /> Scorecard
          </h3>
          
          {/* Innings Tabs */}
          <div className="flex bg-aurora-800 rounded-xl p-1 border border-aurora-600">
            {scorecard?.map((inning: any, idx: number) => (
              <button 
                key={idx}
                onClick={() => setActiveInning(idx)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeInning === idx ? 'bg-aurora-300 text-aurora-950' : 'text-text-body hover:text-text-primary'}`}
              >
                {inning.team}
              </button>
            ))}
          </div>

          {/* Active Innings Display */}
          <div className="bg-aurora-800 border border-aurora-600 rounded-xl overflow-hidden">
            <div className="bg-aurora-700/50 px-4 py-3 border-b border-aurora-600 flex justify-between items-center">
              <h4 className="font-bold text-text-primary">{scorecard[activeInning]?.team || 'Unknown Team'} Innings</h4>
              <span className="font-black text-aurora-300">{scorecard[activeInning]?.totalRuns || 0}/{scorecard[activeInning]?.totalWickets || 0} <span className="text-xs text-text-body font-normal">({scorecard[activeInning]?.overs || '0.0'} ov)</span></span>
            </div>
            
            {/* Batting Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-text-muted bg-aurora-950/20 uppercase">
                  <tr>
                    <th className="px-4 py-2">Batter</th>
                    <th className="px-4 py-2 text-right">R</th>
                    <th className="px-4 py-2 text-right">B</th>
                    <th className="px-4 py-2 text-right">4s</th>
                    <th className="px-4 py-2 text-right">6s</th>
                    <th className="px-4 py-2 text-right">SR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aurora-600/30">
                  {scorecard[activeInning]?.batters?.map((b: any) => (
                    <tr key={b.name} className="hover:bg-aurora-700/30">
                      <td className="px-4 py-2 font-medium text-text-primary">
                        {b.name}
                        <div className="text-text-muted text-xs font-normal">{b.dismissal}</div>
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-text-primary">{b.runs}</td>
                      <td className="px-4 py-2 text-right text-text-body">{b.balls}</td>
                      <td className="px-4 py-2 text-right text-text-body">{b.fours}</td>
                      <td className="px-4 py-2 text-right text-text-body">{b.sixes}</td>
                      <td className="px-4 py-2 text-right text-text-body">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Did Not Bat */}
            {scorecard[activeInning]?.didNotBat && scorecard[activeInning]?.didNotBat?.length > 0 && (
              <div className="px-4 py-3 border-t border-aurora-600 text-sm">
                <span className="font-bold text-text-body">Did not bat: </span>
                <span className="text-text-muted">{scorecard[activeInning]?.didNotBat.join(', ')}</span>
              </div>
            )}

            {/* Bowling Table */}
            <div className="overflow-x-auto border-t border-aurora-600">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-text-muted bg-aurora-950/20 uppercase">
                  <tr>
                    <th className="px-4 py-2">Bowler</th>
                    <th className="px-4 py-2 text-right">O</th>
                    <th className="px-4 py-2 text-right">R</th>
                    <th className="px-4 py-2 text-right">W</th>
                    <th className="px-4 py-2 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aurora-600/30">
                  {scorecard[activeInning]?.bowlers?.map((b: any) => {
                    const overs = Math.floor(b.balls / 6) + (b.balls % 6) / 10;
                    const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(1) : '0.0';
                    return (
                      <tr key={b.name} className="hover:bg-aurora-700/30">
                        <td className="px-4 py-2 font-medium text-text-primary">{b.name}</td>
                        <td className="px-4 py-2 text-right text-text-body">{overs}</td>
                        <td className="px-4 py-2 text-right text-text-body">{b.runs}</td>
                        <td className="px-4 py-2 text-right font-bold text-text-primary">{b.wickets}</td>
                        <td className="px-4 py-2 text-right text-text-body">{econ}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center text-text-muted italic bg-aurora-700/50 p-6 rounded-xl">
          Detailed scorecard data is not available for this match.
        </div>
      )}

      {/* Info Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-black italic text-text-primary flex items-center gap-2">
          <Info size={20} className="text-aurora-300" /> Match Info
        </h3>
        <div className="bg-aurora-800 p-6 rounded-xl border border-aurora-600 space-y-3">
          <div className="flex justify-between border-b border-aurora-600/50 pb-2">
            <span className="text-text-muted">Toss</span>
            <span className="text-text-primary font-medium text-right">{tossWinner ? `${tossWinner} won the toss and elected to ${tossDecision}` : 'N/A'}</span>
          </div>
          <div className="flex justify-between border-b border-aurora-600/50 pb-2">
            <span className="text-text-muted">Venue</span>
            <span className="text-text-primary font-medium text-right">{venue}{city ? `, ${city}` : ''}</span>
          </div>
          <div className="flex justify-between border-b border-aurora-600/50 pb-2">
            <span className="text-text-muted">Date</span>
            <span className="text-text-primary font-medium text-right">{match.match_date ? new Date(match.match_date).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div className="flex justify-between border-b border-aurora-600/50 pb-2">
            <span className="text-text-muted">Umpires</span>
            <span className="text-text-primary font-medium text-right">{officials.field.join(', ') || 'N/A'}</span>
          </div>
          <div className="flex justify-between border-b border-aurora-600/50 pb-2">
            <span className="text-text-muted">3rd Umpire</span>
            <span className="text-text-primary font-medium text-right">{officials.tv || 'N/A'}</span>
          </div>
          <div className="flex justify-between border-b border-aurora-600/50 pb-2">
            <span className="text-text-muted">Reserve Umpire</span>
            <span className="text-text-primary font-medium text-right">{officials.reserve || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Referee</span>
            <span className="text-text-primary font-medium text-right">{officials.referee || 'N/A'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const MatchesSection: React.FC<{ onBackToHome?: () => void; initialTournament?: Tournament | null }> = ({ onBackToHome, initialTournament }) => {
  const [view, setView] = useState<'tournaments' | 'matches' | 'detail'>('tournaments');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(initialTournament || null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  useEffect(() => {
    if (initialTournament) {
      setSelectedTournament(initialTournament);
      setView('matches');
    }
  }, [initialTournament]);

  const handleBack = () => {
    if (view === 'detail') {
      setView('matches');
    } else if (view === 'matches') {
      setView('tournaments');
    } else if (view === 'tournaments') {
      if (onBackToHome) onBackToHome();
    }
  };

  return (
    <div className="relative overflow-hidden min-h-[400px]">
      <div className="mb-6">
        <motion.button 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={handleBack}
          className="flex items-center justify-center w-10 h-10 bg-aurora-700/50 border border-aurora-600 rounded-xl hover:bg-aurora-700 transition-all text-aurora-300 group shadow-lg"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        </motion.button>
      </div>
      <AnimatePresence mode="wait">
        {view === 'tournaments' && (
          <TournamentsList 
            key="tournaments"
            onSelect={(t) => {
              setSelectedTournament(t);
              setView('matches');
            }} 
          />
        )}
        {view === 'matches' && selectedTournament && (
          <TournamentMatchesList 
            key="matches"
            tournament={selectedTournament} 
            onBack={() => setView('tournaments')}
            onSelectMatch={(id) => {
              setSelectedMatchId(id);
              setView('detail');
            }}
          />
        )}
        {view === 'detail' && selectedMatchId && (
          <MatchDetail 
            key="detail"
            matchId={selectedMatchId} 
            onBack={() => setView('matches')} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
