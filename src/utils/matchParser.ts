export interface HeatmapData {
  over_no: number;
  ball_no: number;
  impactScore: number;
  wicket_kind: string | null;
  runs: number;
  batter: string;
  bowler: string;
  isWicket: boolean;
}

/**
* Extracts delivery-level data for a specific inning from raw match information.
* @example
* extractInningData(rawInfo, activeInning)
* [{ over_no: 1, ball_no: 1, ... }, { over_no: 1, ball_no: 2, ... }]
* @param {any} rawInfo - Raw match info object containing innings data.
* @param {number} activeInning - Zero-based index of the inning to extract.
* @returns {any[]} Return an array of normalized delivery objects for the selected inning, or an empty array if unavailable.
**/
export function extractInningData(rawInfo: any, activeInning: number): any[] {
  if (!rawInfo || !rawInfo.innings) {
    return [];
  }

  let inningsList = [];
  if (Array.isArray(rawInfo.innings)) {
    inningsList = rawInfo.innings;
  } else {
    inningsList = Object.values(rawInfo.innings).map(
      (inn: any) => Object.values(inn)[0],
    );
  }

  const inningData = inningsList[activeInning];
  if (!inningData) {
    return [];
  }

  const deliveries: any[] = [];
  if (inningData.overs) {
    inningData.overs.forEach((over: any) => {
      if (over.deliveries) {
        over.deliveries.forEach((d: any, idx: number) => {
          deliveries.push({ ...d, over_no: over.over + 1, ball_no: idx + 1 });
        });
      }
    });
  } else if (inningData.deliveries) {
    let currentOver = 1;
    let currentBall = 1;
    inningData.deliveries.forEach((dObj: any) => {
      const [key] = Object.keys(dObj);
      const overNo = Math.floor(parseFloat(key)) + 1;
      if (overNo !== currentOver) {
        currentOver = overNo;
        currentBall = 1;
      }
      deliveries.push({
        ...dObj[key],
        over_no: overNo,
        ball_no: currentBall,
      });
      currentBall += 1;
    });
  }
  return deliveries;
}

/**
 * Parses raw inning delivery data into heatmap-friendly delivery summaries for an active inning.
 * @example
 * parseInningDeliveries(rawInfo, 1)
 * [{ over_no: 1, ball_no: 1, impactScore: 2, wicket_kind: null, runs: 0, batter: "Unknown", bowler: "Unknown", isWicket: false }]
 * @param {any} rawInfo - Raw match information containing inning delivery data.
 * @param {number} activeInning - The inning number to extract and parse.
 * @returns {HeatmapData[]} Array of parsed delivery objects with scoring and wicket details.
 **/
export function parseInningDeliveries(rawInfo: any, activeInning: number): HeatmapData[] {
  const deliveries = extractInningData(rawInfo, activeInning);

  return deliveries.map((d: any) => {
    const runs = d.runs ? d.runs.total || 0 : 0;
    const isWicket = d.wickets && d.wickets.length > 0;
    const wicketKind = isWicket ? d.wickets[0].kind : null;

    let impactScore = 0;
    if (isWicket) impactScore = 10;
    else if (runs >= 6) impactScore = 8;
    else if (runs >= 4) impactScore = 6;
    else if (runs === 0) impactScore = 2;
    else impactScore = 1;

    return {
      over_no: d.over_no,
      ball_no: d.ball_no,
      impactScore,
      wicket_kind: wicketKind,
      runs,
      batter: d.batter || d.batsman || "Unknown",
      bowler: d.bowler || "Unknown",
      isWicket,
    };
  });
}
