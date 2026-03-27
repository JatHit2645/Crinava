import React, { useState, useEffect } from 'react';
import { Trophy, MapPin, Calendar, ArrowLeft, Loader2, ChevronRight, Star, Info, Activity, Coins } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';

interface Tournament {
  event_name: string;
  season: string;
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
  if (!rawInfo || !rawInfo.innings) return [];

  const players = rawInfo.info?.players || {};

  let inningsList = [];
  if (Array.isArray(rawInfo.innings)) {
    inningsList = rawInfo.innings;
  } else {
    inningsList = Object.values(rawInfo.innings).map((inn: any) => Object.values(inn)[0]);
  }

  return inningsList.map((inning: any) => {
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
      if (!bowlers[bowler]) bowlers[bowler] = { name: bowler, balls: 0, runs: 0, wickets: 0 };

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
            else if (w.kind === 'caught') dismissal = `c ${w.fielders ? w.fielders.map((f:any)=>f.name).join(', ') : 'sub'} b ${bowler}`;
            else if (w.kind === 'lbw') dismissal = `lbw b ${bowler}`;
            else if (w.kind === 'run out') dismissal = `run out`;
            else if (w.kind === 'stumped') dismissal = `st ${w.fielders ? w.fielders.map((f:any)=>f.name).join(', ') : 'sub'} b ${bowler}`;
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

const TournamentsList: React.FC<{ onSelect: (t: Tournament) => void }> = ({ onSelect }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTournaments = async () => {
      setLoading(true);
      let allData: any[] = [];
      let hasMore = true;
      let start = 0;
      const limit = 1000;

      while (hasMore) {
        const { data, error } = await supabase
          .from('matches')
          .select('event_name, season')
          .range(start, start + limit - 1);

        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          allData = [...allData, ...data];
          start += limit;
          if (data.length < limit) hasMore = false;
        }
      }

      const unique: Tournament[] = [];
      const map = new Set();
      for (const row of allData) {
        const event = row.event_name || 'Unknown Tournament';
        const season = row.season || 'Unknown Season';
        const key = `${event}-${season}`;
        if (!map.has(key)) {
          map.add(key);
          unique.push({ event_name: event, season: season });
        }
      }

      unique.sort((a, b) => {
        if (a.season !== b.season) return b.season.localeCompare(a.season);
        return a.event_name.localeCompare(b.event_name);
      });

      setTournaments(unique);
      setLoading(false);
    };
    fetchTournaments();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <Loader2 className="animate-spin text-aurora-teal" size={32} />
      <p className="text-gray-400 animate-pulse">Loading all tournaments...</p>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-2xl font-black italic text-white">Tournaments & Series</h2>
        <span className="text-sm text-aurora-teal font-bold">{tournaments.length} Found</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tournaments.map((t, idx) => (
          <div 
            key={idx} 
            onClick={() => onSelect(t)}
            className="p-6 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl cursor-pointer hover:border-aurora-teal/50 transition-all group flex justify-between items-center"
          >
            <div>
              <h3 className="text-xl font-black text-white group-hover:text-aurora-teal transition-colors">{t.event_name}</h3>
              <p className="text-sm text-gray-500">{t.season}</p>
            </div>
            <ChevronRight className="text-gray-600 group-hover:text-aurora-teal transition-colors" />
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const TournamentMatchesList: React.FC<{ tournament: Tournament; onBack: () => void; onSelectMatch: (id: number) => void }> = ({ tournament, onBack, onSelectMatch }) => {
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      let allMatches: MatchData[] = [];
      let hasMore = true;
      let start = 0;
      const limit = 1000;

      while (hasMore) {
        const { data, error } = await supabase
          .from('matches')
          .select('match_id, team_1, team_2, match_date, venue, outcome_result')
          .eq('event_name', tournament.event_name)
          .eq('season', tournament.season)
          .order('match_date', { ascending: false })
          .range(start, start + limit - 1);
        
        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          allMatches = [...allMatches, ...data];
          start += limit;
          if (data.length < limit) hasMore = false;
        }
      }
      
      setMatches(allMatches);
      setLoading(false);
    };
    fetchMatches();
  }, [tournament]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-aurora-teal" size={32} /></div>;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-4">
        <ArrowLeft size={18} /> Back to Tournaments
      </button>
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-black italic text-white">{tournament.event_name}</h2>
          <p className="text-aurora-teal">{tournament.season}</p>
        </div>
        <span className="text-sm text-gray-400 font-bold">{matches.length} Matches</span>
      </div>
      
      <div className="space-y-4">
        {matches.map((match) => (
          <div 
            key={match.match_id} 
            onClick={() => onSelectMatch(match.match_id)}
            className="p-4 bg-[#111111] border border-white/10 rounded-xl shadow-lg cursor-pointer hover:border-aurora-teal/30 transition-all"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500">{match.match_date}</span>
              <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={12}/> {match.venue}</span>
            </div>
            <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-lg border border-white/5">
              <div className="text-lg font-black text-white flex-1 text-center">{match.team_1}</div>
              <div className="text-xs font-black text-gray-500 px-4">VS</div>
              <div className="text-lg font-black text-white flex-1 text-center">{match.team_2}</div>
            </div>
            <div className="mt-3 text-center text-sm text-aurora-teal font-medium">
              {match.outcome_result}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const MatchDetail: React.FC<{ matchId: number; onBack: () => void }> = ({ matchId, onBack }) => {
  const [match, setMatch] = useState<MatchData | null>(null);
  const [mvp, setMvp] = useState<any>(null);
  const [officials, setOfficials] = useState<any>({ field: [], tv: null, referee: null });
  const [loading, setLoading] = useState(true);
  const [activeInning, setActiveInning] = useState(0);

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

      // Fetch MVP
      console.log("Fetching MVP for match:", matchId);
      const { data: mvpData, error: mvpError } = await supabase
        .from('player_match_impact') 
        .select('player_name, total_impact_score')
        .eq('match_id', matchId)
        .order('total_impact_score', { ascending: false })
        .limit(5);
      
      if (mvpError) {
        console.error("Error fetching MVP:", mvpError);
      } else {
        console.log("MVP Data:", mvpData);
        setMvp(mvpData);
      }

      // Fetch Officials
      const { data: umpiresData } = await supabase
        .from('match_umpires')
        .select('role, official_id')
        .eq('match_id', matchId);
      
      console.log("Umpires Data:", umpiresData);
      
      let field: string[] = [];
      let tv: string | null = null;

      if (umpiresData && umpiresData.length > 0) {
        const officialIds = umpiresData.map(u => u.official_id);
        const { data: officialsData } = await supabase
          .from('officials')
          .select('official_id, name')
          .in('official_id', officialIds);
        
        console.log("Officials Data:", officialsData);

        if (officialsData) {
          umpiresData.forEach(u => {
            const official = officialsData.find(o => o.official_id === u.official_id);
            if (official) {
              if (u.role === 'field') field.push(official.name);
              if (u.role === 'tv') tv = official.name;
            }
          });
        }
      }

      let referee: string | null = null;
      if (matchData?.match_referee_id) {
        const { data: refData } = await supabase
          .from('officials')
          .select('name')
          .eq('official_id', matchData.match_referee_id)
          .single();
        console.log("Referee Data:", refData);
        if (refData) referee = refData.name;
      }
      setOfficials({ field, tv, referee });

      setLoading(false);
    };
    fetchMatchData();
  }, [matchId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-aurora-teal" size={32} /></div>;
  if (!match) return <div className="text-white text-center py-20">Match data could not be loaded.</div>;

  const scorecard = parseScorecard(match.raw_info);

  // Helper to get team name from ID
  const getTeamName = (id: string | number | undefined) => {
    if (id == '1') return match.team_1;
    if (id == '2') return match.team_2;
    return id;
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 bg-[#111111] border border-white/10 rounded-2xl shadow-2xl space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors">
        <ArrowLeft size={18} /> Back to Matches
      </button>
      
      <div className="text-center space-y-2">
        <div className="text-xs font-bold text-aurora-teal uppercase tracking-widest">{match.match_type}</div>
        <h2 className="text-2xl font-black italic text-white">{match.team_1} <span className="text-gray-500 text-lg">vs</span> {match.team_2}</h2>
        <p className="text-gray-400 font-medium text-lg">{match.outcome_result}</p>
      </div>
      
      {/* Crinava MVP Section */}
      <div className="bg-gradient-to-br from-aurora-teal/20 to-transparent border border-aurora-teal/30 p-5 rounded-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Star size={64} />
        </div>
        <h3 className="text-sm font-black text-aurora-teal uppercase tracking-wider mb-3 flex items-center gap-2">
          <Trophy size={16} /> Crinava Match MVP
        </h3>
        
        {mvp && mvp.length > 0 ? (
          <div>
            <div className="text-2xl font-black text-white mb-1">{mvp[0].player_name}</div>
            <div className="flex items-end gap-3">
              <div className="text-3xl font-black text-metallic-gold">{Number(mvp[0].total_impact_score).toFixed(1)} <span className="text-sm text-gray-400 font-normal">Impact Score</span></div>
            </div>
            <select className="mt-3 bg-black/50 text-white text-xs p-2 rounded border border-white/10 w-full">
              {mvp.map((p: any, i: number) => (
                <option key={i}>{p.player_name} - {Number(p.total_impact_score).toFixed(1)} pts</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-gray-400 text-sm italic">MVP calculation pending...</div>
        )}
      </div>

      {/* POTM */}
      <div className="bg-white/5 p-4 rounded-xl flex items-center gap-4">
        <Trophy className="text-aurora-teal" size={24}/>
        <div>
          <div className="text-gray-500 text-xs">Player of the Match</div>
          <div className="text-white font-bold">{match.player_of_match || 'N/A'}</div>
        </div>
      </div>

      {/* Scorecard Section */}
      {scorecard.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-xl font-black italic text-white flex items-center gap-2">
            <Activity size={20} className="text-aurora-teal" /> Scorecard
          </h3>
          
          {/* Innings Tabs */}
          <div className="flex bg-[#1a1a1a] rounded-xl p-1 border border-white/10">
            {scorecard.map((inning: any, idx: number) => (
              <button 
                key={idx}
                onClick={() => setActiveInning(idx)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeInning === idx ? 'bg-aurora-teal text-black' : 'text-gray-400 hover:text-white'}`}
              >
                {inning.team}
              </button>
            ))}
          </div>

          {/* Active Innings Display */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden">
            <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex justify-between items-center">
              <h4 className="font-bold text-white">{scorecard[activeInning].team} Innings</h4>
              <span className="font-black text-aurora-teal">{scorecard[activeInning].totalRuns}/{scorecard[activeInning].totalWickets} <span className="text-xs text-gray-400 font-normal">({scorecard[activeInning].overs} ov)</span></span>
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
                  {scorecard[activeInning].batters.map((b: any) => (
                    <tr key={b.name} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2 font-medium text-white">
                        {b.name}
                        <div className="text-gray-500 text-xs font-normal">{b.dismissal}</div>
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-white">{b.runs}</td>
                      <td className="px-4 py-2 text-right text-gray-400">{b.balls}</td>
                      <td className="px-4 py-2 text-right text-gray-400">{b.fours}</td>
                      <td className="px-4 py-2 text-right text-gray-400">{b.sixes}</td>
                      <td className="px-4 py-2 text-right text-gray-400">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Did Not Bat */}
            {scorecard[activeInning].didNotBat && scorecard[activeInning].didNotBat.length > 0 && (
              <div className="px-4 py-3 border-t border-white/10 text-sm">
                <span className="font-bold text-gray-400">Did not bat: </span>
                <span className="text-gray-500">{scorecard[activeInning].didNotBat.join(', ')}</span>
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
                  {scorecard[activeInning].bowlers.map((b: any) => {
                    const overs = Math.floor(b.balls / 6) + (b.balls % 6) / 10;
                    const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(1) : '0.0';
                    return (
                      <tr key={b.name} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-2 font-medium text-white">{b.name}</td>
                        <td className="px-4 py-2 text-right text-gray-400">{overs}</td>
                        <td className="px-4 py-2 text-right text-gray-400">{b.runs}</td>
                        <td className="px-4 py-2 text-right font-bold text-white">{b.wickets}</td>
                        <td className="px-4 py-2 text-right text-gray-400">{econ}</td>
                      </tr>
                    );
                  })}
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

      {/* Info Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-black italic text-white flex items-center gap-2">
          <Info size={20} className="text-aurora-teal" /> Match Info
        </h3>
        <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 space-y-3">
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Toss</span>
            <span className="text-white font-medium text-right">{match.toss_winner_id ? `${getTeamName(match.toss_winner_id)} won the toss and elected to ${match.toss_decision}` : 'N/A'}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Venue</span>
            <span className="text-white font-medium text-right">{match.venue}{match.city ? `, ${match.city}` : ''}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Date</span>
            <span className="text-white font-medium text-right">{match.match_date ? new Date(match.match_date).toLocaleDateString() : 'N/A'}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">Umpires</span>
            <span className="text-white font-medium text-right">{officials.field.join(', ') || 'N/A'}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-2">
            <span className="text-gray-500">3rd Umpire</span>
            <span className="text-white font-medium text-right">{officials.tv || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Referee</span>
            <span className="text-white font-medium text-right">{officials.referee || 'N/A'}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const MatchesSection: React.FC = () => {
  const [view, setView] = useState<'tournaments' | 'matches' | 'detail'>('tournaments');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  return (
    <div className="relative overflow-hidden min-h-[400px]">
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
