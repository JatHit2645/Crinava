import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface MomentumData {
  over: number;
  score: number;
  event?: string;
}

/**
 * Renders a momentum area chart with a glowing cyan gradient, zero baseline, and tooltip.
 * @example
 * MomentumGraph(data)
 * <div>...</div>
 * @param {Array<Object>} data - Array of chart data points containing at least `over` and `score` fields.
 * @returns {JSX.Element} A styled React component displaying the momentum graph.
 **/
export const MomentumGraph: React.FC<{ data: MomentumData[] }> = ({ data }) => {
  return (
    <div className="h-[300px] w-full bg-[#0A0A0A] p-6 rounded-[32px] border border-white/5">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorMomentum" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00FFFF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00FFFF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="over" hide />
          <YAxis domain={[-100, 100]} hide />
          <Tooltip
            contentStyle={{
              backgroundColor: "#050505",
              border: "1px solid #333",
              borderRadius: "12px",
            }}
            itemStyle={{
              color: "#00FFFF",
              fontSize: "10px",
              fontWeight: "bold",
            }}
          />
          <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#00FFFF"
            fillOpacity={1}
            fill="url(#colorMomentum)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
