export interface ImpactStats {
  name: string;
  role: "batter" | "bowler";
  totalImpact: number;
  balls: number;
  impactPerBall: number;
  runs: number;
  wickets: number;
  matchCount: number;
  normalizedScore: number; // 0-100 scale for easy reading
}

export interface ImpactBaselines {
  expectedRunsPerBall: number;
  wicketValue: number;
}

/**
 * Calculates a player's impact from ball-by-ball deliveries by comparing actual runs and wickets to league-average expectations.
 * @example
 * calculateImpact(deliveries, playerId, playerName, "batter")
 * { name: "Player Name", role: "batter", totalImpact: 12.34, balls: 45, impactPerBall: 0.274, runs: 62, wickets: 1, matchCount: 3, normalizedScore: 77.4 }
 * @param {any[]} deliveries - Array of delivery objects used to compute impact.
 * @param {string} playerId - Unique player identifier to filter relevant deliveries.
 * @param {string} playerName - Player display name included in the returned impact stats.
 * @param {"batter" | "bowler"} role - Player role used to determine how runs and wickets are evaluated.
 * @param {ImpactBaselines} baselines - Baseline values used for league-average run and wicket expectations.
 * @returns {ImpactStats} Returns an impact summary including total impact, per-ball impact, raw stats, match count, and normalized score.
 */
export function calculateImpact(
  deliveries: any[],
  playerId: string,
  playerName: string,
  role: "batter" | "bowler" = "batter",
  baselines: ImpactBaselines = {
    expectedRunsPerBall: 0.478,
    wicketValue: 26.56,
  },
): ImpactStats {
  let balls = 0;
  let runs = 0;
  let wickets = 0;
  const matchIds = new Set<string>();

  deliveries.forEach((d) => {
    const isBatter = String(d.batter_id) === String(playerId);
    const isBowler = String(d.bowler_id) === String(playerId);

    if (role === "batter" && !isBatter) return;
    if (role === "bowler" && !isBowler) return;

    balls += 1;
    matchIds.add(d.match_id);

    const runsScored = d.runs_batter || 0;
    const extras = d.runs_extras || 0;
    const totalRuns = runsScored + extras;

    if (role === "batter") {
      runs += runsScored;
      if (String(d.wicket_player_out) === String(playerId)) {
        wickets += 1;
      }
    } else {
      // Bowler
      runs += totalRuns;
      if (
        d.wicket_kind &&
        ![
          "run out",
          "retired hurt",
          "obstructing the field",
          "retired out",
        ].includes(d.wicket_kind)
      ) {
        wickets += 1;
      }
    }
  });

  // Impact Logic: Runs Above Average (RAA)
  // We compare the player to a "League Average" player facing the same number of balls.
  const leagueRPB = baselines.expectedRunsPerBall;
  const leagueAverage = baselines.wicketValue; // This is Runs Per Wicket
  const leagueBPW = leagueRPB > 0 ? leagueAverage / leagueRPB : 100;

  const expectedRuns = balls * leagueRPB;
  const expectedWickets = balls / leagueBPW;

  let totalImpact = 0;
  if (role === "batter") {
    const wicketsSaved = expectedWickets - wickets;
    totalImpact = runs - expectedRuns + wicketsSaved * leagueAverage;
  } else {
    // For bowlers, fewer runs and more wickets is better
    const extraWickets = wickets - expectedWickets;
    totalImpact = expectedRuns - runs + extraWickets * leagueAverage;
  }

  const impactPerBall = balls > 0 ? totalImpact / balls : 0;

  // Normalize score to a 0-100 scale.
  // Elite impact per ball is around +0.3 to +0.5.
  // Average is 50.
  let normalizedScore = 50 + impactPerBall * 100;
  normalizedScore = Math.max(0, Math.min(100, normalizedScore));

  return {
    name: playerName,
    role,
    totalImpact: Number(totalImpact.toFixed(2)),
    balls,
    impactPerBall: Number(impactPerBall.toFixed(3)),
    runs,
    wickets,
    matchCount: matchIds.size,
    normalizedScore: Number(normalizedScore.toFixed(1)),
  };
}
