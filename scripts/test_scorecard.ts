import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

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
    const battersOrder: string[] = [];
    const bowlersOrder: string[] = [];
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
      const nonStriker = d.non_striker;
      
      if (!battersOrder.includes(batter)) battersOrder.push(batter);
      if (nonStriker && !battersOrder.includes(nonStriker)) battersOrder.push(nonStriker);

      if (!batters[batter]) batters[batter] = { name: batter, runs: 0, balls: 0, fours: 0, sixes: 0, dismissal: 'not out', sr: '0.00' };

      const runsBatter = d.runs ? d.runs.batter || d.runs.batsman || 0 : 0;
      batters[batter].runs += runsBatter;

      let isWide = d.extras && d.extras.wides;
      if (!isWide) batters[batter].balls += 1;
      if (runsBatter === 4) batters[batter].fours += 1;
      if (runsBatter === 6) batters[batter].sixes += 1;
      
      if (batters[batter].balls > 0) {
        batters[batter].sr = ((batters[batter].runs / batters[batter].balls) * 100).toFixed(2);
      }

      // Bowling
      const bowler = d.bowler;
      if (!bowlersOrder.includes(bowler)) bowlersOrder.push(bowler);
      
      if (!bowlers[bowler]) bowlers[bowler] = { name: bowler, balls: 0, runs: 0, wickets: 0, dots: 0, econ: '0.00' };

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
      batters: battersOrder.map(name => batters[name]).filter(Boolean),
      bowlers: bowlersOrder.map(name => bowlers[name]).filter(Boolean),
      extras,
      didNotBat
    };
  });
};

async function testScorecard() {
  const { data, error } = await supabase
    .from('matches')
    .select('match_id, raw_info')
    .limit(1);

  if (error) {
    console.error('Supabase error:', error);
    return;
  }

  if (data && data.length > 0) {
    const rawInfo = data[0].raw_info;
    console.log('Testing rawInfo type:', typeof rawInfo);
    try {
      const result = parseScorecard(rawInfo);
      console.log('Parse result length:', result.length);
      if (result.length > 0) {
        console.log('First inning team:', result[0].team);
        console.log('Batters count:', result[0].batters.length);
      } else {
        console.log('Parse failed. Inspecting rawInfo structure...');
        const parsedInfo = typeof rawInfo === 'string' ? JSON.parse(rawInfo) : rawInfo;
        console.log('Has innings?', !!parsedInfo?.innings);
        console.log('Innings type?', Array.isArray(parsedInfo?.innings) ? 'Array' : typeof parsedInfo?.innings);
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  } else {
    console.log('No matches found in DB');
  }
}

testScorecard();
