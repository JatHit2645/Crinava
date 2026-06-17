import React, { useEffect, useState } from "react";
import { TrendingUp, X, Zap, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface HeatmapData {
  over_no: number;
  ball_no: number;
  impactScore: number;
  wicket_kind: string | null;
  runs: number;
  batter: string;
  bowler: string;
}

export const TurningPointHeatmap: React.FC<{ rawInfo: any }> = ({
  rawInfo,
}) => {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBall, setSelectedBall] = useState<HeatmapData | null>(null);
  const [activeInning, setActiveInning] = useState(0);

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

    const formattedData: HeatmapData[] = deliveries.map((d: any) => {
      const runs = d.runs ? d.runs.total || 0 : 0;
      const isWicket = d.wickets && d.wickets.length > 0;
      const wicketKind = isWicket ? d.wickets[0].kind : null;

      // Calculate impact score (0-10)
      let impactScore = 0;
      if (isWicket) impactScore = 10;
      else if (runs >= 6) impactScore = 8;
      else if (runs >= 4) impactScore = 6;
      else if (runs === 0)
        impactScore = 2; // Dot ball pressure
      else impactScore = 1;

      return {
        over_no: d.over_no,
        ball_no: d.ball_no,
        impactScore,
        wicket_kind: wicketKind,
        runs,
        batter: d.batter || d.batsman || "Unknown",
        bowler: d.bowler || "Unknown",
      };
    });

    setData(formattedData);
    setLoading(false);
  }, [rawInfo, activeInning]);

  if (loading)
    return (
      <div className="h-[400px] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-aurora-teal/20 border-t-aurora-teal rounded-full animate-spin" />
        <div className="text-gray-500 text-xs uppercase font-black tracking-widest animate-pulse">
          Mapping Match DNA...
        </div>
      </div>
    );

  // Group data by over and ball
  const grid: Record<number, Record<number, HeatmapData>> = {};
  let maxOver = 0;
  let maxBall = 6;
  data.forEach((d) => {
    if (!grid[d.over_no]) grid[d.over_no] = {};
    grid[d.over_no][d.ball_no] = d;
    if (d.over_no > maxOver) maxOver = d.over_no;
    if (d.ball_no > maxBall) maxBall = d.ball_no;
  });

  const overs = Array.from({ length: Math.max(20, maxOver) }, (_, i) => i + 1);
  const balls = Array.from({ length: Math.max(6, maxBall) }, (_, i) => i + 1);

  const getCellColor = (d?: HeatmapData) => {
    if (!d) return "bg-white/5";
    if (d.wicket_kind)
      return "bg-[#FF4D4D] shadow-[0_0_10px_rgba(255,77,77,0.4)]";
    if (d.impactScore > 7)
      return "bg-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.4)]";
    if (d.impactScore > 4)
      return "bg-[#11EBCF] shadow-[0_0_10px_rgba(17,235,207,0.4)]";
    return "bg-[#11EBCF]/20";
  };

  return (
    <div className="bg-[#1a1a1a] p-6 rounded-xl border border-white/10 relative overflow-hidden group h-full">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <TrendingUp size={64} />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase italic flex items-center gap-2">
            <Zap size={20} className="text-aurora-teal" /> Ball-by-Ball Impact
            Map
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Match DNA: A high-resolution heatmap of every delivery and its
            psychological weight.
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

      <div className="overflow-x-auto pb-4 scrollbar-hide">
        <div className="min-w-[800px]">
          {data.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-gray-500 text-xs uppercase font-black tracking-widest">
              No data for this inning
            </div>
          ) : (
            <div
              className="grid grid-cols-[40px_repeat(auto-fit,minmax(30px,1fr))] gap-2"
              style={{
                gridTemplateColumns: `40px repeat(${overs.length}, minmax(30px, 1fr))`,
              }}
            >
              {/* Header row for Overs */}
              <div />
              {overs.map((o) => (
                <div
                  key={o}
                  className="text-[10px] font-black text-gray-600 text-center uppercase"
                >
                  Ov {o}
                </div>
              ))}

              {/* Rows for Balls */}
              {balls.map((b) => (
                <React.Fragment key={b}>
                  <div className="text-[10px] font-black text-gray-600 flex items-center justify-center uppercase">
                    Ball {b}
                  </div>
                  {overs.map((o) => {
                    const d = grid[o]?.[b];
                    return (
                      <motion.button
                        key={`${o}-${b}`}
                        whileHover={{ scale: 1.2, zIndex: 10 }}
                        onClick={() => d && setSelectedBall(d)}
                        className={`h-8 rounded-sm transition-all duration-300 ${getCellColor(d)} ${!d ? "cursor-default" : "cursor-pointer hover:brightness-125"}`}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-t border-white/5 pt-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#FF4D4D] rounded-sm" />
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
            Wicket
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#FFD700] rounded-sm" />
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
            Boundary/Six
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#11EBCF] rounded-sm" />
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
            Four
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#11EBCF]/20 rounded-sm" />
          <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
            Dot/Single
          </span>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-aurora-teal/5 rounded-2xl border border-aurora-teal/20 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Info size={48} />
          </div>
          <h4 className="text-aurora-teal font-black uppercase tracking-widest text-[10px] mb-2">
            How to read
          </h4>
          <p className="text-xs text-gray-300 leading-relaxed font-medium">
            Each cell represents a single delivery. The{" "}
            <span className="text-white font-bold">Intensity</span> is
            calculated based on runs, wickets, and psychological pressure.
            Darker/Brighter cells indicate game-defining moments.
          </p>
        </div>
        <div className="p-5 bg-metallic-gold/5 rounded-2xl border border-metallic-gold/20 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <Zap size={48} />
          </div>
          <h4 className="text-metallic-gold font-black uppercase tracking-widest text-[10px] mb-2">
            The "Human" Insight
          </h4>
          <p className="text-xs text-gray-300 leading-relaxed font-medium">
            Look for clusters of{" "}
            <span className="text-metallic-gold font-bold uppercase">Gold</span>{" "}
            and <span className="text-[#FF4D4D] font-bold uppercase">Red</span>.
            These are the "Turning Point" phases where the match was effectively
            decided by individual brilliance or tactical failure.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {selectedBall && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 flex items-center justify-center z-50 p-6 bg-black/60 backdrop-blur-sm"
          >
            <div className="bg-[#111] border border-aurora-teal/30 p-8 rounded-3xl shadow-2xl max-w-md w-full relative">
              <button
                onClick={() => setSelectedBall(null)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>

              <div className="text-center space-y-6">
                <div>
                  <div className="text-aurora-teal font-black uppercase tracking-[0.2em] text-[10px] mb-2">
                    Delivery Analysis
                  </div>
                  <div className="text-5xl font-black text-white italic tracking-tighter">
                    Over {selectedBall.over_no}.{selectedBall.ball_no}
                  </div>
                </div>

                <div
                  className={`p-6 rounded-2xl ${selectedBall.wicket_kind ? "bg-red-500/10 border border-red-500/20" : "bg-aurora-teal/10 border border-aurora-teal/20"}`}
                >
                  <div className="text-3xl font-black text-white mb-2">
                    {selectedBall.wicket_kind
                      ? "WICKET!"
                      : `${selectedBall.runs} Runs`}
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {selectedBall.wicket_kind
                      ? `A massive shift in momentum as ${selectedBall.batter} was dismissed via ${selectedBall.wicket_kind} by ${selectedBall.bowler}.`
                      : `${selectedBall.batter} scored ${selectedBall.runs} runs off ${selectedBall.bowler}.`}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedBall(null)}
                  className="w-full py-4 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-aurora-teal transition-all"
                >
                  Close Analysis
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
