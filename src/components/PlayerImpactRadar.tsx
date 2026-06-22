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
import { extractInningData } from "../utils/matchParser";
import { InningSelector } from "./shared/InningSelector";

/**
 * Renders a radar chart visualizing player impact data.
 * @example
 * PlayerImpactRadar({ data, color, name })
 * <RadarChart />
 * @param {{data: any[]}} data - Array of radar chart data points.
 * @param {string} color - Stroke and fill color for the radar series.
 * @param {string} name - Display name for the radar series.
 * @returns {JSX.Element} A responsive radar chart component.
 **/
const ImpactRadarChart = ({ data, color, name }: { data: any[], color: string, name: string }) => (
  <ResponsiveContainer width="100%" height="100%">
    <RadarChart cx="50%" cy="50%" outerRadius="55%" data={data}>
      <PolarGrid stroke="#333" />
      <PolarAngleAxis
        dataKey="subject"
        tick={{ fill: "#999", fontSize: 10, fontWeight: "bold" }}
        tickSize={20}
      />
      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
      <Radar name={name} dataKey="A" stroke={color} fill={color} fillOpacity={0.4} />
      <Tooltip
        contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: "12px" }}
        itemStyle={{ color: "#11EBCF", fontSize: "10px", fontWeight: "bold" }}
      />
    </RadarChart>
  </ResponsiveContainer>
);

export const PlayerImpactRadar: React.FC<{
  rawInfo: any;
  playerId: string;
  allPlayers?: string[];
/**
 * Analyzes a selected player's batting and bowling impact for the chosen inning and renders radar chart data.
 * @example
 * PlayerImpactRadar({ rawInfo, playerId: "player_1", allPlayers: ["player_1", "player_2"] })
 * { battingData: [...], bowlingData: [...], loading: false }
 * @param {object} { rawInfo, playerId, allPlayers } - Match data, the initial selected player ID, and an optional list of players to choose from.
 * @returns {JSX.Element} A player impact radar visualization with batting and bowling metrics for the selected inning.
 **/
}> = ({ rawInfo, playerId: initialPlayerId, allPlayers = [] }) => {
  const [battingData, setBattingData] = useState<any[]>([]);
  const [bowlingData, setBowlingData] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState(initialPlayerId);
  const [activeInning, setActiveInning] = useState<number>(0); // 0 for 1st inning, 1 for 2nd inning
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const deliveries = extractInningData(rawInfo, activeInning);
    if (!deliveries.length) {
      setBattingData([]);
      setBowlingData([]);
      setLoading(false);
      return;
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
          <InningSelector activeInning={activeInning} setActiveInning={setActiveInning} />

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
                <ImpactRadarChart data={battingData} color="#11EBCF" name={selectedPlayer} />
              </div>
            )}
            {bowlingData.length > 0 && (
              <div className="h-[350px] flex flex-col items-center">
                <h3 className="text-metallic-gold font-black uppercase tracking-widest text-xs mb-2">
                  Bowling
                </h3>
                <ImpactRadarChart data={bowlingData} color="#FFD700" name={selectedPlayer} />
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
