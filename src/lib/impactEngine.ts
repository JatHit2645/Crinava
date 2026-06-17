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

    balls++;
    matchIds.add(d.match_id);

    const runsScored = d.runs_batter || 0;
    const extras = d.runs_extras || 0;
    const totalRuns = runsScored + extras;

    if (role === "batter") {
      runs += runsScored;
      if (String(d.wicket_player_out) === String(playerId)) {
        wickets++;
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
        wickets++;
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
