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

/**
 * Aggregates batting and bowling statistics for a player from a list of delivery records.
 * @example
 * aggregateDeliveries(deliveries, playerId, playerName)
 * { name: "Player Name", runs: 45, ballsFaced: 30, fours: 4, sixes: 1, dismissals: 1, wickets: 2, runsConceded: 28, ballsBowled: 24, average: "45.00", strikeRate: "150.00", economy: "7.00", bowlingAverage: "14.00", overs: "4.0" }
 * @param {any[]} deliveries - List of delivery objects to process for batting and bowling stats.
 * @param {string | number} playerId - Unique identifier of the player to match against delivery records.
 * @param {string} playerName - Display name of the player to include in the returned stats.
 * @returns {PlayerStats} Aggregated player statistics including batting, bowling, and rate metrics.
 **/
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

  const processBatting = (d: any) => {
    if (String(d.batter_id) !== String(playerId)) return;
    const r = d.runs_batter || 0;
    runs += r;
    ballsFaced += 1;
    if (r === 4) fours += 1;
    if (r === 6) sixes += 1;
    if (String(d.wicket_player_out) === String(playerId)) {
      dismissals += 1;
    }
  };

  /**
  * Updates bowling statistics for a delivery by filtering on bowler ID and aggregating balls, runs, and wickets.
  * @example
  * updateBowlingStats(d)
  * undefined
  * @param {any} d - Delivery object containing bowler, runs, extras, and wicket information.
  * @returns {void} No return value.
  **/
  const processBowling = (d: any) => {
    if (String(d.bowler_id) !== String(playerId)) return;
    const isWide = d.runs_extras > 0 && !d.wicket_kind;
    const isNoBall = false;

    if (!isWide && !isNoBall) {
      ballsBowled += 1;
    }

    runsConceded += (d.runs_batter || 0) + (d.runs_extras || 0);

    if (
      d.wicket_kind &&
      !["run out", "retired hurt", "obstructing the field", "retired out"].includes(
        d.wicket_kind
      )
    ) {
      wickets += 1;
    }
  };

  deliveries.forEach((d) => {
    processBatting(d);
    processBowling(d);
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
