export interface PlayerStats {
  name: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  dismissals: number;
  wickets: number;
  runsConceded: number;
  ballsBowled: number;
  average: string;
  strikeRate: string;
  economy: string;
  bowlingAverage: string;
  overs: string;
}

export function aggregateDeliveries(
  deliveries: any[],
  playerId: string | number,
  playerName: string,
): PlayerStats {
  let runs = 0;
  let ballsFaced = 0;
  let fours = 0;
  let sixes = 0;
  let dismissals = 0;
  let wickets = 0;
  let runsConceded = 0;
  let ballsBowled = 0;

  deliveries.forEach((d) => {
    // Batting
    if (String(d.batter_id) === String(playerId)) {
      const r = d.runs_batter || 0;
      runs += r;
      ballsFaced += 1;
      if (r === 4) fours += 1;
      if (r === 6) sixes += 1;
      if (String(d.wicket_player_out) === String(playerId)) {
        dismissals += 1;
      }
    }

    // Bowling
    if (String(d.bowler_id) === String(playerId)) {
      const isWide = d.runs_extras > 0 && !d.wicket_kind; // Simplified wide check
      const isNoBall = false; // Simplified

      if (!isWide && !isNoBall) {
        ballsBowled += 1;
      }

      runsConceded += (d.runs_batter || 0) + (d.runs_extras || 0);

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

  const overs = `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`;

  return {
    name: playerName,
    runs,
    ballsFaced,
    fours,
    sixes,
    dismissals,
    wickets,
    runsConceded,
    ballsBowled,
    average: dismissals > 0 ? (runs / dismissals).toFixed(2) : runs.toFixed(2),
    strikeRate:
      ballsFaced > 0 ? ((runs / ballsFaced) * 100).toFixed(2) : "0.00",
    economy:
      ballsBowled > 0 ? (runsConceded / (ballsBowled / 6)).toFixed(2) : "0.00",
    bowlingAverage: wickets > 0 ? (runsConceded / wickets).toFixed(2) : "N/A",
    overs,
  };
}
