import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Waves } from "lucide-react";

interface MomentumPoint {
  over: number;
  pressure: number;
  isTurningPoint?: boolean;
}

export const MomentumMap: React.FC<{ rawInfo: any }> = ({ rawInfo }) => {
  const [data, setData] = useState<MomentumPoint[]>([]);
  const [activeInning, setActiveInning] = useState<number>(0);
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
        if (over.deliveries)
          deliveries.push(
            ...over.deliveries.map((d: any) => ({
              ...d,
              over_no: over.over + 1,
            })),
          );
      });
    } else if (inningData.deliveries) {
      inningData.deliveries.forEach((dObj: any) => {
        const [key] = Object.keys(dObj);
        const overNo = Math.floor(parseFloat(key)) + 1;
        deliveries.push({ ...dObj[key], over_no: overNo });
      });
    }

    const overData: Record<number, { runs: number; wickets: number }> = {};
    let maxOver = 0;

    deliveries.forEach((d: any) => {
      const over = d.over_no;
      const runs = d.runs ? d.runs.total || 0 : 0;
      const wickets = d.wickets ? d.wickets.length : 0;

      if (!overData[over]) overData[over] = { runs: 0, wickets: 0 };
      overData[over].runs += runs;
      overData[over].wickets += wickets;
      if (over > maxOver) maxOver = over;
    });

    // Calculate raw pressure per over
    // Baseline is roughly 8 runs per over.
    // Positive = Batting dominance, Negative = Bowling dominance
    const rawPressures: Record<number, number> = {};
    for (let i = 1; i <= maxOver; i += 1) {
      const stats = overData[i] || { runs: 0, wickets: 0 };
      rawPressures[i] = stats.runs - 8 - stats.wickets * 12;
    }

    // Apply a 3-over rolling average to smooth the wave
    const formattedData: MomentumPoint[] = [];
    for (let i = 1; i <= maxOver; i += 1) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(1, i - 1); j <= Math.min(maxOver, i + 1); j += 1) {
        sum += rawPressures[j];
        count += 1;
      }
      const smoothedPressure = sum / count;

      // Identify turning points: significant shifts in momentum
      let isTurningPoint = false;
      if (i > 1) {
        const prevPressure = formattedData[i - 2]?.pressure || 0;
        if (Math.abs(smoothedPressure - prevPressure) >= 15) {
          isTurningPoint = true;
        }
      }

      formattedData.push({
        over: i,
        pressure: parseFloat(smoothedPressure.toFixed(2)),
        isTurningPoint,
      });
    }

    setData(formattedData);
    setLoading(false);
  }, [rawInfo, activeInning]);

  if (loading)
    return <div className="text-white">Analyzing Pressure Waves...</div>;

  return (
    <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 relative overflow-hidden group h-full">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Waves size={64} />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic flex items-center gap-2">
            <Waves size={20} className="text-aurora-teal" /> Momentum Map
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Pressure Wave Analysis: Visualizing the psychological and tactical
            shifts in the game's intensity.
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
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#ffffff05"
                vertical={false}
              />
              <XAxis
                dataKey="over"
                stroke="#444"
                fontSize={10}
                tickFormatter={(val) => `Ov ${val}`}
                minTickGap={10}
              />
              <YAxis
                stroke="#444"
                fontSize={10}
                tickFormatter={(val) => (val > 0 ? `+${val}` : val)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111",
                  border: "1px solid #333",
                  borderRadius: "12px",
                }}
                itemStyle={{
                  color: "#11EBCF",
                  fontSize: "10px",
                  fontWeight: "bold",
                }}
                cursor={{
                  stroke: "#11EBCF",
                  strokeWidth: 1,
                  strokeDasharray: "5 5",
                }}
              />
              <Line
                type="monotone"
                dataKey="pressure"
                stroke="#11EBCF"
                strokeWidth={3}
                dot={{ r: 2, fill: "#11EBCF", strokeWidth: 0 }}
                activeDot={{
                  r: 5,
                  fill: "#fff",
                  stroke: "#11EBCF",
                  strokeWidth: 2,
                }}
              />
              <ReferenceLine y={0} stroke="#ffffff40" strokeWidth={2} />
              {data.map(
                (p, i) =>
                  p.isTurningPoint && (
                    <ReferenceLine
                      key={i}
                      x={p.over}
                      stroke="#FFD700"
                      strokeDasharray="3 3"
                      label={{
                        value: "Turning Point",
                        position: "top",
                        fill: "#FFD700",
                        fontSize: 10,
                        fontWeight: "bold",
                      }}
                    />
                  ),
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-aurora-teal/5 rounded-xl border border-aurora-teal/20">
          <h4 className="text-aurora-teal font-black uppercase tracking-widest text-[10px] mb-2">
            What this shows
          </h4>
          <p className="text-xs text-gray-300 leading-relaxed">
            The{" "}
            <span className="text-aurora-teal font-bold uppercase">
              Pressure Wave
            </span>{" "}
            represents which team is currently dictating the pace of the game.
            Positive values indicate dominance by the batting side, while
            negative values show the bowling side applying intense pressure.
          </p>
        </div>
        <div className="p-4 bg-metallic-gold/5 rounded-xl border border-metallic-gold/20">
          <h4 className="text-metallic-gold font-black uppercase tracking-widest text-[10px] mb-2">
            Why it matters
          </h4>
          <p className="text-xs text-gray-300 leading-relaxed">
            Identifying these waves helps in understanding game-changing phases.
            A{" "}
            <span className="text-metallic-gold font-bold uppercase">
              Turning Point
            </span>{" "}
            (gold dashed line) marks a delivery or over where the pressure
            shifted irreversibly, often deciding the match outcome.
          </p>
        </div>
      </div>
    </div>
  );
};
