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
import { ChevronDown, Activity, MapPin } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export const MirrorMatch: React.FC<{
  rawInfo: any;
  venue: string;
  matchType?: string;
}> = ({ rawInfo, venue, matchType = "T20" }) => {
  const [data, setData] = useState<any[]>([]);
  const [selectedOver, setSelectedOver] = useState(6);
  const [selectedMetric, setSelectedMetric] = useState<string>("runs");
  const [loading, setLoading] = useState(true);

  const maxOvers =
    rawInfo?.info?.overs || (matchType.toUpperCase().includes("ODI") ? 50 : 20);
  const overOptions = Array.from({ length: maxOvers }, (_, i) => i + 1);

  const metrics = [
    { id: "runs", label: "Total Runs", color: "#11EBCF" },
    { id: "wickets", label: "Wickets Fallen", color: "#FF4D4D" },
    { id: "runRate", label: "Run Rate", color: "#FFD700" },
    { id: "boundaries", label: "Total Boundaries (4s+6s)", color: "#9D4EDD" },
    { id: "sixes", label: "Sixes Hit", color: "#FF9E00" },
    { id: "fours", label: "Fours Hit", color: "#3A86FF" },
    { id: "dotBalls", label: "Dot Balls", color: "#8338EC" },
    { id: "dotBallPercent", label: "Dot Ball %", color: "#FF006E" },
    { id: "extras", label: "Extras Conceded", color: "#06D6A0" },
    { id: "runsPerWicket", label: "Runs per Wicket", color: "#FB5607" },
    { id: "ballsPerBoundary", label: "Balls per Boundary", color: "#38B000" },
  ];

  useEffect(() => {
    const fetchVenueData = async () => {
      setLoading(true);
      if (!venue) {
        setData([]);
        setLoading(false);
        return;
      }

      try {
        const { data: matches, error } = await supabase
          .from("matches")
          .select("match_date, team_1, team_2, raw_info")
          .eq("venue", venue)
          .eq("match_type", matchType)
          .order("match_date", { ascending: true })
          .limit(30); // Limit to recent 30 matches for readability

        if (error) throw error;

        const processedData = matches
          .map((match: any) => {
            const info = match.raw_info;
            if (!info || !info.innings) return null;

            let inningsList = [];
            if (Array.isArray(info.innings)) {
              inningsList = info.innings;
            } else {
              inningsList = Object.values(info.innings).map(
                (inn: any) => Object.values(inn)[0],
              );
            }

            let matchTotalRuns = 0;
            let matchTotalWickets = 0;
            let matchTotalBoundaries = 0;
            let matchTotalSixes = 0;
            let matchTotalFours = 0;
            let matchTotalDotBalls = 0;
            let matchTotalExtras = 0;
            let matchTotalLegalBalls = 0;
            let matchTotalBalls = 0;

            inningsList.forEach((inningData: any) => {
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
                  const key = Object.keys(dObj)[0];
                  const overNo = Math.floor(parseFloat(key)) + 1;
                  deliveries.push({ ...dObj[key], over_no: overNo });
                });
              }

              deliveries.forEach((d: any) => {
                if (d.over_no <= selectedOver) {
                  matchTotalBalls += 1;
                  const r = d.runs ? d.runs.total || 0 : 0;
                  const batterRuns = d.runs
                    ? d.runs.batter || d.runs.batsman || 0
                    : 0;
                  matchTotalRuns += r;

                  if (d.wickets) matchTotalWickets += d.wickets.length;
                  if (batterRuns === 4) matchTotalFours += 1;
                  if (batterRuns === 6) matchTotalSixes += 1;
                  if (batterRuns === 4 || batterRuns === 6)
                    matchTotalBoundaries += 1;
                  if (r === 0) matchTotalDotBalls += 1;
                  if (d.extras) {
                    matchTotalExtras +=
                      (d.extras.wides || 0) +
                      (d.extras.noballs || 0) +
                      (d.extras.legbyes || 0) +
                      (d.extras.byes || 0) +
                      (d.extras.penalty || 0);
                  }

                  const isWide = d.extras && d.extras.wides;
                  const isNoBall = d.extras && d.extras.noballs;
                  if (!isWide && !isNoBall) matchTotalLegalBalls += 1;
                }
              });
            });

            // Average per inning
            const numInnings = inningsList.length || 1;
            const runRate =
              matchTotalLegalBalls > 0
                ? (matchTotalRuns / matchTotalLegalBalls) * 6
                : 0;
            const dotBallPercent =
              matchTotalBalls > 0
                ? (matchTotalDotBalls / matchTotalBalls) * 100
                : 0;
            const runsPerWicket =
              matchTotalWickets > 0
                ? matchTotalRuns / matchTotalWickets
                : matchTotalRuns;
            const ballsPerBoundary =
              matchTotalBoundaries > 0
                ? matchTotalLegalBalls / matchTotalBoundaries
                : matchTotalLegalBalls;

            return {
              date: new Date(match.match_date).toLocaleDateString(undefined, {
                month: "short",
                year: "2-digit",
              }),
              fullDate: match.match_date,
              matchName: `${match.team_1} vs ${match.team_2}`,
              runs: parseFloat((matchTotalRuns / numInnings).toFixed(2)),
              wickets: parseFloat((matchTotalWickets / numInnings).toFixed(2)),
              runRate: parseFloat(runRate.toFixed(2)),
              boundaries: parseFloat(
                (matchTotalBoundaries / numInnings).toFixed(2),
              ),
              sixes: parseFloat((matchTotalSixes / numInnings).toFixed(2)),
              fours: parseFloat((matchTotalFours / numInnings).toFixed(2)),
              dotBalls: parseFloat(
                (matchTotalDotBalls / numInnings).toFixed(2),
              ),
              dotBallPercent: parseFloat(dotBallPercent.toFixed(2)),
              extras: parseFloat((matchTotalExtras / numInnings).toFixed(2)),
              runsPerWicket: parseFloat(runsPerWicket.toFixed(2)),
              ballsPerBoundary: parseFloat(ballsPerBoundary.toFixed(2)),
            };
          })
          .filter(Boolean);

        setData(processedData);
      } catch (err) {
        console.error("Error fetching venue data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVenueData();
  }, [venue, matchType, selectedOver]);

  const activeMetric =
    metrics.find((m) => m.id === selectedMetric) || metrics[0];

  // Calculate average for the reference line
  const averageValue =
    data.length > 0
      ? data.reduce((sum, item) => sum + item[selectedMetric], 0) / data.length
      : 0;

  return (
    <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 relative overflow-hidden group h-full">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Activity size={64} />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic flex items-center gap-2">
            <Activity size={20} className="text-aurora-teal" /> Mirror Match
          </h2>
          <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
            <MapPin size={12} /> Venue Analysis: Historical comparison at{" "}
            {venue}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={selectedOver}
              onChange={(e) => setSelectedOver(parseInt(e.target.value, 10))}
              className="appearance-none bg-black/40 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 pr-8 rounded-lg outline-none focus:border-aurora-teal transition-all"
            >
              {overOptions.map((o) => (
                <option key={o} value={o}>
                  Up to Over {o}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            />
          </div>

          <div className="relative">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="appearance-none bg-black/40 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 pr-8 rounded-lg outline-none focus:border-aurora-teal transition-all"
            >
              {metrics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            />
          </div>
        </div>
      </div>

      <div className="h-[350px] w-full">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-xs uppercase font-black tracking-widest animate-pulse">
            Extracting historical venue data...
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-xs uppercase font-black tracking-widest">
            No historical data available for this venue
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#ffffff05"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="#444"
                tick={{ fill: "#666", fontSize: 10 }}
                tickMargin={10}
              />
              <YAxis
                stroke="#444"
                tick={{ fill: "#666", fontSize: 10 }}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111",
                  border: "1px solid #333",
                  borderRadius: "8px",
                }}
                itemStyle={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: activeMetric.color,
                }}
                labelStyle={{
                  color: "#888",
                  fontSize: "10px",
                  marginBottom: "4px",
                }}
                cursor={{
                  stroke: "#ffffff20",
                  strokeWidth: 1,
                  strokeDasharray: "3 3",
                }}
                formatter={(value: number) => [value, activeMetric.label]}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0) {
                    return payload[0].payload.matchName;
                  }
                  return label;
                }}
              />
              <ReferenceLine
                y={averageValue}
                stroke="#ffffff40"
                strokeDasharray="3 3"
                label={{
                  position: "top",
                  value: "Venue Avg",
                  fill: "#ffffff80",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey={selectedMetric}
                name={activeMetric.label}
                stroke={activeMetric.color}
                strokeWidth={3}
                dot={{
                  r: 3,
                  fill: "#1a1a1a",
                  stroke: activeMetric.color,
                  strokeWidth: 2,
                }}
                activeDot={{
                  r: 6,
                  fill: activeMetric.color,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                animationDuration={1500}
              />
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
            This chart tracks the{" "}
            <span className="text-white font-bold">
              average {activeMetric.label.toLowerCase()} per inning
            </span>{" "}
            across historical matches played at{" "}
            <span className="text-white font-bold">{venue}</span> up to{" "}
            <span className="text-white font-bold">Over {selectedOver}</span>.
          </p>
        </div>
        <div className="p-4 bg-metallic-gold/5 rounded-xl border border-metallic-gold/20">
          <h4 className="text-metallic-gold font-black uppercase tracking-widest text-[10px] mb-2">
            Why it matters
          </h4>
          <p className="text-xs text-gray-300 leading-relaxed">
            By comparing historical data at the same venue, you can identify{" "}
            <span className="text-metallic-gold font-bold uppercase">
              Venue Trends
            </span>{" "}
            and determine if a team's performance in a specific phase was above
            or below the venue average.
          </p>
        </div>
      </div>
    </div>
  );
};
