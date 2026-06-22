import React, { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Trophy, ChevronDown } from "lucide-react";

export const PlayerImpactRadar: React.FC<{
  rawInfo: any;
  playerId: string;
  allPlayers?: string[];
/**
 * Renders a player impact radar chart for batting and bowling performance across innings.
 * @example
 * PlayerImpactRadar({ rawInfo, playerId: "P123", allPlayers: ["P123", "P456"] })
 * <PlayerImpactRadar />
 * @param {Object} rawInfo - Match data containing innings, overs, deliveries, and related score details.
 * @param {string} playerId - Initial player identifier to analyze.
 * @param {Array<string>} allPlayers - List of selectable player identifiers.
 * @returns {JSX.Element} A React component displaying radar charts, inning selection, and player impact summaries.
 **/
}> = ({ rawInfo, playerId: initialPlayerId, allPlayers = [] }) => {
  const [battingData, setBattingData] = useState<any[]>([]);
  const [bowlingData, setBowlingData] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState(initialPlayerId);
  const [activeInning, setActiveInning] = useState<number>(0); // 0 for 1st inning, 1 for 2nd inning
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    if (!rawInfo || !rawInfo.innings) {
      setBattingData([]);
      setBowlingData([]);
      setLoading(false);
      return;
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
      setBattingData([]);
      setBowlingData([]);
      setLoading(false);
      return;
    }

    const deliveries: any[] = [];
    if (inningData.overs) {
      inningData.overs.forEach((over: any) => {
        if (over.deliveries) deliveries.push(...over.deliveries);
      });
    } else if (inningData.deliveries) {
      inningData.deliveries.forEach((dObj: any) => {
        const [key] = Object.keys(dObj);
        deliveries.push(dObj[key]);
      });
    }

    let runsScored = 0;
    let ballsFaced = 0;
    let boundaries = 0;
    let dotsFaced = 0;

    let runsConceded = 0;
    let ballsBowled = 0;
    let dotsBowled = 0;
    let wicketsTaken = 0;

    deliveries.forEach((d: any) => {
      const batter = d.batter || d.batsman;
      const bowler = d.bowler;

      const runsBatter = d.runs ? d.runs.batter || d.runs.batsman || 0 : 0;
      const isWide = d.extras && d.extras.wides;
      const isLegalBall = !isWide && !(d.extras && d.extras.noballs);

      if (batter === selectedPlayer) {
        runsScored += runsBatter;
        if (!isWide) ballsFaced += 1;
        if (runsBatter === 4 || runsBatter === 6) boundaries += 1;
        if (runsBatter === 0 && !d.extras) dotsFaced += 1;
      }

      if (bowler === selectedPlayer) {
        let bowlerRuns = runsBatter;
        if (d.extras) {
          if (d.extras.wides) bowlerRuns += d.extras.wides;
          if (d.extras.noballs) bowlerRuns += d.extras.noballs;
        }
        runsConceded += bowlerRuns;
        if (isLegalBall) ballsBowled += 1;
        if (runsBatter === 0 && !d.extras) dotsBowled += 1;

        if (d.wickets) {
          d.wickets.forEach((w: any) => {
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
              wicketsTaken += 1;
            }
          });
        }
      }
    });

    if (ballsFaced > 0) {
      const strikeRate = (runsScored / ballsFaced) * 100;
      const boundaryPct = (boundaries / ballsFaced) * 100;
      const dotBallPct = (dotsFaced / ballsFaced) * 100;
      const nonDotPct = 100 - dotBallPct;

      setBattingData([
        {
          subject: "Runs",
          A: Math.min(100, runsScored * 1.5),
          value: runsScored.toString(),
          fullMark: 100,
        },
        {
          subject: "Strike Rate",
          A: Math.min(100, strikeRate / 2),
          value: strikeRate.toFixed(2),
          fullMark: 100,
        },
        {
          subject: "Boundary %",
          A: Math.min(100, boundaryPct * 2.5),
          value: `${boundaryPct.toFixed(2)}%`,
          fullMark: 100,
        },
        {
          subject: "Non-Dot %",
          A: Math.min(100, nonDotPct),
          value: `${nonDotPct.toFixed(2)}%`,
          fullMark: 100,
        },
        {
          subject: "Balls Faced",
          A: Math.min(100, ballsFaced * 2),
          value: ballsFaced.toString(),
          fullMark: 100,
        },
      ]);
    } else {
      setBattingData([]);
    }

    if (ballsBowled > 0) {
      const economy = (runsConceded / ballsBowled) * 6;
      const dotBallPct = (dotsBowled / ballsBowled) * 100;

      setBowlingData([
        {
          subject: "Wickets",
          A: Math.min(100, wicketsTaken * 25),
          value: wicketsTaken.toString(),
          fullMark: 100,
        },
        {
          subject: "Economy",
          A: economy > 0 ? Math.max(0, 100 - economy * 8) : 0,
          value: economy.toFixed(2),
          fullMark: 100,
        },
        {
          subject: "Dot Ball %",
          A: Math.min(100, dotBallPct * 1.5),
          value: `${dotBallPct.toFixed(2)}%`,
          fullMark: 100,
        },
        {
          subject: "Runs Conceded",
          A: Math.max(0, 100 - runsConceded * 1.5),
          value: runsConceded.toString(),
          fullMark: 100,
        },
        {
          subject: "Balls Bowled",
          A: Math.min(100, ballsBowled * 2),
          value: ballsBowled.toString(),
          fullMark: 100,
        },
      ]);
    } else {
      setBowlingData([]);
    }

    setLoading(false);
  }, [selectedPlayer, rawInfo, activeInning]);

  /**
  * Renders a custom tooltip for the player impact radar chart when a data point is active.
  * @example
  * CustomTooltip({ active: true, payload: [{ payload: { subject: "Passing", value: 85 } }] })
  * <div>Passing 85</div>
  * @param {{any}} active - Indicates whether the tooltip should be shown.
  * @param {{any}} payload - Chart payload containing the active data point information.
  * @returns {{JSX.Element | null}} Tooltip markup when active data is available, otherwise null.
  **/
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#111] border border-[#333] p-3 rounded-lg shadow-xl">
          <p className="text-[#11EBCF] text-xs font-bold mb-1">
            {payload[0].payload.subject}
          </p>
          <p className="text-white text-sm font-black">
            {payload[0].payload.value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 relative overflow-hidden group h-full">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Trophy size={64} />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic flex items-center gap-2">
            <Trophy size={20} className="text-aurora-teal" /> Player Impact
            Radar
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Multi-Dimensional Analysis
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setActiveInning(0)}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded transition-colors ${activeInning === 0 ? "text-aurora-teal bg-aurora-teal/10" : "text-gray-500 hover:text-white"}`}
            >
              Inning 1
            </button>
            <button
              onClick={() => setActiveInning(1)}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded transition-colors ${activeInning === 1 ? "text-aurora-teal bg-aurora-teal/10" : "text-gray-500 hover:text-white"}`}
            >
              Inning 2
            </button>
          </div>

          {allPlayers.length > 0 && (
            <div className="relative">
              <select
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="appearance-none bg-black/40 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 pr-8 rounded-lg outline-none focus:border-aurora-teal transition-all max-w-[200px]"
              >
                {allPlayers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
            </div>
          )}
        </div>
      </div>

      <div className="w-full">
        {loading ? (
          <div className="h-[350px] flex items-center justify-center text-gray-500 text-xs uppercase font-black tracking-widest animate-pulse">
            Calculating impact dimensions...
          </div>
        ) : battingData.length === 0 && bowlingData.length === 0 ? (
          <div className="h-[350px] flex items-center justify-center text-gray-500 text-xs uppercase font-black tracking-widest">
            Did not bat or bowl in this inning
          </div>
        ) : (
          <div
            className={`grid grid-cols-1 ${battingData.length > 0 && bowlingData.length > 0 ? "md:grid-cols-2" : ""} gap-4`}
          >
            {battingData.length > 0 && (
              <div className="h-[350px] flex flex-col items-center">
                <h3 className="text-aurora-teal font-black uppercase tracking-widest text-xs mb-2">
                  Batting
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="55%"
                    data={battingData}
                  >
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#999", fontSize: 10, fontWeight: "bold" }}
                      tickSize={20}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name={selectedPlayer}
                      dataKey="A"
                      stroke="#11EBCF"
                      fill="#11EBCF"
                      fillOpacity={0.4}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            {bowlingData.length > 0 && (
              <div className="h-[350px] flex flex-col items-center">
                <h3 className="text-metallic-gold font-black uppercase tracking-widest text-xs mb-2">
                  Bowling
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="55%"
                    data={bowlingData}
                  >
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#999", fontSize: 10, fontWeight: "bold" }}
                      tickSize={20}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name={selectedPlayer}
                      dataKey="A"
                      stroke="#FFD700"
                      fill="#FFD700"
                      fillOpacity={0.4}
                    />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-aurora-teal/5 rounded-xl border border-aurora-teal/20">
          <h4 className="text-aurora-teal font-black uppercase tracking-widest text-[10px] mb-2">
            What this shows
          </h4>
          <p className="text-xs text-gray-300 leading-relaxed">
            This radar chart breaks down{" "}
            <span className="text-white font-bold">{selectedPlayer}'s</span>{" "}
            contribution across{" "}
            <span className="text-aurora-teal font-bold uppercase">
              key dimensions
            </span>
            . A larger shape indicates a more dominant performance in that area.
          </p>
        </div>
        <div className="p-4 bg-metallic-gold/5 rounded-xl border border-metallic-gold/20">
          <h4 className="text-metallic-gold font-black uppercase tracking-widest text-[10px] mb-2">
            Why it matters
          </h4>
          <p className="text-xs text-gray-300 leading-relaxed">
            A symmetrical shape shows a well-rounded{" "}
            <span className="text-metallic-gold font-bold uppercase">
              "Clutch"
            </span>{" "}
            performance that anchored the team's momentum during critical
            phases.
          </p>
        </div>
      </div>
    </div>
  );
};
