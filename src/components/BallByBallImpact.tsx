import React, { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";
import { Zap } from "lucide-react";

interface ImpactEvent {
  over_no: number;
  ball_no: number;
  impactScore: number;
  type: "wicket" | "boundary" | "dot" | "normal";
  desc: string;
  batter: string;
  bowler: string;
  runs: number;
  z: number;
}

export const BallByBallImpact: React.FC<{ rawInfo: any }> = ({ rawInfo }) => {
  const [data, setData] = useState<ImpactEvent[]>([]);
  const [activeInning, setActiveInning] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    if (!rawInfo || !rawInfo.innings) {
      setData([]);
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
      setData([]);
      setLoading(false);
      return;
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
        const key = Object.keys(dObj)[0];
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
        currentBall++;
      });
    }

    const formattedData: ImpactEvent[] = [];

    deliveries.forEach((d: any) => {
      const runs = d.runs ? d.runs.total || 0 : 0;
      const isWicket = d.wickets && d.wickets.length > 0;
      const batter = d.batter || d.batsman || "Unknown";
      const bowler = d.bowler || "Unknown";

      let impactScore = runs;
      let type: "wicket" | "boundary" | "dot" | "normal" = "normal";
      let desc = `${runs} runs`;
      let z = runs * 20 + 20;

      if (isWicket) {
        impactScore = -5; // Negative impact for batting team, positive for bowling
        type = "wicket";
        desc = `Wicket! (${d.wickets[0].kind})`;
        z = 200;
      } else if (runs >= 4) {
        type = "boundary";
        desc = runs === 6 ? `SIX!` : `FOUR!`;
        z = runs === 6 ? 150 : 100;
      } else if (runs === 0 && !d.extras) {
        type = "dot";
        desc = `Dot ball`;
        z = 30;
      }

      formattedData.push({
        over_no: d.over_no + d.ball_no / 10,
        ball_no: d.ball_no,
        impactScore,
        type,
        desc,
        batter,
        bowler,
        runs,
        z,
      });
    });

    setData(formattedData);
    setLoading(false);
  }, [rawInfo, activeInning]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#111] border border-[#333] p-3 rounded-lg shadow-xl z-50">
          <p className="text-white font-bold mb-1">
            Over {Math.floor(data.over_no)}.{data.ball_no}
          </p>
          <p className="text-aurora-teal text-sm font-black mb-2">
            {data.desc}
          </p>
          <div className="text-xs text-gray-400 space-y-1">
            <p>
              <span className="text-gray-500">Batter:</span> {data.batter}
            </p>
            <p>
              <span className="text-gray-500">Bowler:</span> {data.bowler}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading)
    return <div className="text-white">Analyzing Ball Impacts...</div>;

  return (
    <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 relative overflow-hidden group h-full">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Zap size={64} />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic flex items-center gap-2">
            <Zap size={20} className="text-aurora-teal" /> Ball-by-Ball Impact
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Visualizing the impact of every delivery (Runs scored vs Wickets
            lost).
          </p>
        </div>

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
      </div>

      <div className="h-[350px] w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-xs uppercase font-black tracking-widest">
            No data for this inning
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 20, right: 20, bottom: 20, left: -20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#ffffff05"
                vertical={false}
              />
              <XAxis
                type="number"
                dataKey="over_no"
                stroke="#444"
                tick={{ fill: "#666", fontSize: 10 }}
                tickFormatter={(val) => `Ov ${Math.floor(val)}`}
                domain={["dataMin", "dataMax"]}
              />
              <YAxis
                type="number"
                dataKey="impactScore"
                stroke="#444"
                tick={{ fill: "#666", fontSize: 10 }}
                domain={[-6, 8]}
                hide
              />
              <ZAxis type="number" dataKey="z" range={[20, 200]} />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ strokeDasharray: "3 3" }}
              />
              <ReferenceLine y={0} stroke="#444" />
              <Scatter data={data}>
                {data.map((entry, index) => {
                  let color = "#444";
                  if (entry.type === "wicket") color = "#FF4444";
                  else if (entry.type === "boundary") color = "#11EBCF";
                  else if (entry.type === "dot") color = "#FFD700";
                  else if (entry.runs > 0) color = "#ffffff80";

                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-aurora-teal/5 rounded-xl border border-aurora-teal/20">
          <h4 className="text-aurora-teal font-black uppercase tracking-widest text-[10px] mb-2">
            Legend
          </h4>
          <div className="flex flex-wrap gap-4 text-xs text-gray-300">
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-[#FF4444]"></div> Wickets
              (-5)
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-[#11EBCF]"></div>{" "}
              Boundaries
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-[#ffffff80]"></div> Runs
              (1-3)
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-[#FFD700]"></div> Dot
              Balls (0)
            </div>
          </div>
        </div>
        <div className="p-4 bg-metallic-gold/5 rounded-xl border border-metallic-gold/20">
          <h4 className="text-metallic-gold font-black uppercase tracking-widest text-[10px] mb-2">
            Why it matters
          </h4>
          <p className="text-xs text-gray-300 leading-relaxed">
            This scatter chart provides a clear view of the{" "}
            <span className="text-metallic-gold font-bold uppercase">
              Flow of Runs and Wickets
            </span>
            . Bubbles above the line represent runs scored, while bubbles below
            the line (red) represent wickets lost. The size of the bubble
            indicates the magnitude of the impact.
          </p>
        </div>
      </div>
    </div>
  );
};
