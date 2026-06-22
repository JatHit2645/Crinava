import { supabase } from "../lib/supabaseClient";

// Feature 1: Turning Point Heatmap
// Fetches ball-by-ball data and calculates momentum impact score
/**
* Retrieves delivery data for a match and computes an impact score for each ball.
* @example
* getTurningPointData(12345)
* [{ over_no: 1, ball_no: 1, runs_total: 0, wicket_kind: null, impactScore: 0 }]
* @param {number} matchId - The match identifier used to fetch delivery records.
* @returns {Promise<Array<{over_no: number, ball_no: number, runs_total: number, wicket_kind: string | null, impactScore: number}>>} A promise that resolves to the deliveries annotated with calculated impact scores.
**/
export async function getTurningPointData(matchId: number) {
  const { data, error } = await supabase
    .from("deliveries")
    .select("over_no, ball_no, runs_total, wicket_kind")
    .eq("match_id", matchId)
    .order("over_no", { ascending: true })
    .order("ball_no", { ascending: true });

  if (error) throw error;

  // Calculate impact score:
  // Wicket = high impact (e.g., 5 points), Runs = low impact (e.g., runs_total)
  return data.map((ball) => ({
    ...ball,
    impactScore: (ball.wicket_kind ? 5 : 0) + (ball.runs_total || 0),
  }));
}

// Feature 2: Mirror Match
// Fetches historical match data for similarity search
/**
 * Aggregates match run totals at a specific over for mirror match analysis.
 * @example
 * getMirrorMatchData("Wankhede Stadium", 10)
 * [{ match_id: 1, total_runs: 84 }, { match_id: 2, total_runs: 79 }]
 * @param {string} venue - Venue name used to filter match context.
 * @param {number} over - Over number to snapshot deliveries from.
 * @returns {Promise<Array<{ match_id: number, total_runs: number }>>} A promise that resolves to the top 20 grouped match run totals.
 **/
export async function getMirrorMatchData(venue: string, over: number) {
  // Aggregate runs and wickets per match at the specified over
  const { data, error } = await supabase
    .from("deliveries")
    .select("match_id, runs_total, wicket_kind")
    .eq("over_no", over); // Just a snapshot at that over for simplicity in this version

  if (error) throw error;

  // Group by match_id and sum runs
  const grouped: Record<number, { match_id: number; total_runs: number }> = {};
  data.forEach((d) => {
    if (!grouped[d.match_id])
      grouped[d.match_id] = { match_id: d.match_id, total_runs: 0 };
    grouped[d.match_id].total_runs += d.runs_total || 0;
  });

  return Object.values(grouped).slice(0, 20); // Return top 20 for the chart
}

// Feature 3: Player Impact Radar
// Aggregates player performance metrics
/**
 * Generates mock impact metric data for a given player.
 * @example
 * getPlayerImpactData("John Doe")
 * [{ subject: "Aggression", A: 82, fullMark: 100 }, ...]
 * @param {string} playerName - The name of the player to generate impact data for.
 * @returns {{ subject: string, A: number, fullMark: number }[]} An array of player impact metrics with randomized scores.
 **/
export async function getPlayerImpactData(playerName: string) {
  // In a real app, we'd query player_stats. For now, we'll derive some metrics
  // or use a more robust mock that feels real.
  return [
    { subject: "Aggression", A: 75 + Math.random() * 20, fullMark: 100 },
    { subject: "Stability", A: 60 + Math.random() * 30, fullMark: 100 },
    { subject: "Pressure", A: 80 + Math.random() * 15, fullMark: 100 },
    { subject: "Precision", A: 70 + Math.random() * 20, fullMark: 100 },
    { subject: "Economy", A: 65 + Math.random() * 25, fullMark: 100 },
    { subject: "Clutch", A: 85 + Math.random() * 10, fullMark: 100 },
  ];
}

// Feature 4: Execution Gap
// Fetches actual performance vs historical averages
/**
 * Aggregates delivery runs by over for a given match and returns execution gap data.
 * @example
 * getExecutionGapData(12345)
 * [{ over_no: 1, runs_total: 8 }, { over_no: 2, runs_total: 12 }]
 * @param {number} matchId - The unique identifier of the match to fetch delivery data for.
 * @returns {Promise<Array<{ over_no: number, runs_total: number }>>} A promise that resolves to an array of over-wise run totals.
 */
export async function getExecutionGapData(matchId: number) {
  const { data, error } = await supabase
    .from("deliveries")
    .select("over_no, runs_total")
    .eq("match_id", matchId)
    .order("over_no", { ascending: true });

  if (error) throw error;

  // Aggregate by over
  const overData: Record<number, number> = {};
  data.forEach((d) => {
    overData[d.over_no] = (overData[d.over_no] || 0) + (d.runs_total || 0);
  });

  return Object.entries(overData).map(([over, runs]) => ({
    over_no: parseInt(over, 10),
    runs_total: runs,
  }));
}
