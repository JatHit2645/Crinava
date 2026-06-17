import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  BarChart3,
  Info,
  Search,
  Settings2,
  History,
  ChevronRight,
  Filter,
  Database,
  Zap,
  HelpCircle,
  Trophy,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import ReactMarkdown from "react-markdown";
import { useVerdictStore } from "../store/verdictStore";
import { supabase } from "../lib/supabase";

interface VerdictToolProps {
  scope: "global" | "series" | "match";
  context?: {
    matchId?: number;
    eventName?: string;
    season?: string;
    scorecard?: any[];
  };
}

interface VerdictResult {
  verdict: string;
  confidence: number;
  explanation: string;
  proof: {
    type: "bar" | "line" | "pie";
    data: any[];
    xAxis: string;
    yAxis: string;
    title: string;
  } | null;
  outOfScope?: boolean;
}

const COLORS = ["#00C9B7", "#FFD700", "#FF4D4D", "#A855F7", "#3B82F6"];

export const VerdictTool: React.FC<VerdictToolProps> = ({ scope, context }) => {
  const [activeSubTab, setActiveSubTab] = useState<"ask" | "know">("ask");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerdictResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selectedPlayerIds } = useVerdictStore();
  const [activePlayersForQuery, setActivePlayersForQuery] = useState<string[]>(
    [],
  );
  const [recentVerdicts, setRecentVerdicts] = useState<string[]>([]);

  // "Know Anything" State
  const [playerA, setPlayerA] = useState<string>("");
  const [playerB, setPlayerB] = useState<string>("");
  const [format, setFormat] = useState<string>("all");
  const [selectedMetric, setSelectedMetric] = useState<string>("total_runs");
  const [minDataThreshold, setMinDataThreshold] = useState(100);
  const [manualResult, setManualResult] = useState<any>(null);
  const [allPlayers, setAllPlayers] = useState<{ id: string; name: string }[]>(
    [],
  );

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data } = await supabase
        .from("players")
        .select("player_id, player_name")
        .order("player_name", { ascending: true })
        .limit(100);

      if (data) {
        setAllPlayers(
          data.map((p) => ({ id: p.player_id, name: p.player_name })),
        );
      }
    };
    fetchPlayers();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("recent_verdicts");
    if (saved) setRecentVerdicts(JSON.parse(saved));
  }, []);

  useEffect(() => {
    setActivePlayersForQuery(selectedPlayerIds);
  }, [selectedPlayerIds]);

  const saveRecentVerdict = (q: string) => {
    const updated = [q, ...recentVerdicts.filter((v) => v !== q)].slice(0, 5);
    setRecentVerdicts(updated);
    localStorage.setItem("recent_verdicts", JSON.stringify(updated));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let finalQuery = query;
      if (activePlayersForQuery.length > 0) {
        finalQuery = `Focus on these players: ${activePlayersForQuery.join(", ")}. ${query}`;
      }

      const response = await fetch("/api/verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: finalQuery, scope, context }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }
      const data = await response.json();
      setResult(data);
      saveRecentVerdict(query);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const getVerdictColor = (verdict: string) => {
    const v = verdict.toUpperCase();
    if (v.includes("TRUE") || v.includes("SUPERIOR")) return "text-aurora-teal";
    if (v.includes("FALSE") || v.includes("BELOW")) return "text-red-500";
    if (v.includes("INCONCLUSIVE") || v.includes("TIE"))
      return "text-yellow-500";
    return "text-white";
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      {/* Sub-tab Navigation */}
      <div className="flex p-1 bg-black/40 border border-white/10 rounded-xl w-fit mx-auto mb-8">
        <button
          onClick={() => setActiveSubTab("ask")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black uppercase tracking-wider transition-all ${
            activeSubTab === "ask"
              ? "bg-aurora-teal text-black"
              : "text-gray-500 hover:text-white"
          }`}
        >
          <HelpCircle size={18} /> Ask Anything
        </button>
        <button
          onClick={() => setActiveSubTab("know")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-black uppercase tracking-wider transition-all ${
            activeSubTab === "know"
              ? "bg-aurora-teal text-black"
              : "text-gray-500 hover:text-white"
          }`}
        >
          <Database size={18} /> Know Anything
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-9 space-y-6">
          {activeSubTab === "ask" ? (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-aurora-teal/20 rounded-lg">
                  <Zap className="text-aurora-teal" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white uppercase tracking-wider">
                    AI Verdict Engine
                  </h2>
                  <p className="text-xs text-gray-400">
                    Natural language analysis for complex cricket queries.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a question (e.g., 'Virat vs Rohit in World Cup Finals')"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-5 pl-6 pr-14 text-white placeholder:text-gray-600 focus:outline-none focus:border-aurora-teal/50 transition-all font-medium text-lg"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-aurora-teal text-black rounded-lg hover:bg-aurora-teal/80 disabled:opacity-50 disabled:hover:bg-aurora-teal transition-all"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={24} />
                  ) : (
                    <Send size={24} />
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-aurora-teal/20 rounded-lg">
                    <Settings2 className="text-aurora-teal" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white uppercase tracking-wider">
                      Manual Comparison
                    </h2>
                    <p className="text-xs text-gray-400">
                      Direct data lookup from the 21-dimension engine.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                    <Filter size={14} className="text-gray-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase">
                      Min Data: {minDataThreshold} balls
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      step="50"
                      value={minDataThreshold}
                      onChange={(e) =>
                        setMinDataThreshold(parseInt(e.target.value, 10))
                      }
                      className="w-20 accent-aurora-teal"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                    Player A
                  </label>
                  <select
                    value={playerA}
                    onChange={(e) => setPlayerA(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-aurora-teal/50"
                  >
                    <option value="">Select Player</option>
                    {allPlayers.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                    Player B
                  </label>
                  <select
                    value={playerB}
                    onChange={(e) => setPlayerB(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-aurora-teal/50"
                  >
                    <option value="">Select Player</option>
                    {allPlayers.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                    Format
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-aurora-teal/50"
                  >
                    <option value="all">All Formats</option>
                    <option value="t20i">T20I</option>
                    <option value="odi">ODI</option>
                    <option value="test">Test</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                    Metric
                  </label>
                  <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-aurora-teal/50"
                  >
                    <optgroup label="Volume">
                      <option value="total_runs">Total Runs</option>
                      <option value="total_sixes">Total Sixes</option>
                      <option value="total_fours">Total Fours</option>
                      <option value="total_balls">Total Balls Faced</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!playerA || !playerB) return;
                  setLoading(true);
                  // Mocking the manual result for UI demo
                  setTimeout(() => {
                    setManualResult({
                      metric: selectedMetric,
                      playerA: {
                        name: playerA,
                        value: Math.floor(Math.random() * 10000),
                        avg: 4500,
                      },
                      playerB: {
                        name: playerB,
                        value: Math.floor(Math.random() * 10000),
                        avg: 4500,
                      },
                      leagueAvg: 4500,
                    });
                    setLoading(false);
                  }, 800);
                }}
                disabled={loading || !playerA || !playerB}
                className="w-full py-3 bg-aurora-teal text-black rounded-xl font-black uppercase tracking-widest hover:bg-aurora-teal/80 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <BarChart3 size={20} />
                )}
                Compare Players
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-500"
              >
                <AlertCircle size={20} />
                <span className="text-sm font-medium">{error}</span>
              </motion.div>
            )}

            {activeSubTab === "ask" && result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Verdict Header */}
                <div
                  className={`bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 text-center relative overflow-hidden ${result.outOfScope ? "opacity-70" : ""}`}
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-aurora-teal to-transparent opacity-30" />

                  <div className="flex justify-center mb-4">
                    {result.verdict.toUpperCase().includes("TRUE") ||
                    result.verdict.toUpperCase().includes("SUPERIOR") ? (
                      <CheckCircle2 size={48} className="text-aurora-teal" />
                    ) : result.verdict.toUpperCase().includes("FALSE") ||
                      result.verdict.toUpperCase().includes("BELOW") ? (
                      <XCircle size={48} className="text-red-500" />
                    ) : (
                      <Info size={48} className="text-yellow-500" />
                    )}
                  </div>

                  <h3
                    className={`text-4xl font-black italic mb-2 ${getVerdictColor(result.verdict)}`}
                  >
                    {result.verdict}
                  </h3>

                  {!result.outOfScope && (
                    <div className="flex items-center justify-center gap-2">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        Confidence Score
                      </div>
                      <div className="px-2 py-0.5 bg-white/5 rounded text-sm font-black text-metallic-gold">
                        {result.confidence}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Explanation */}
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Info size={14} /> Analysis & Explanation
                  </h4>
                  <div className="prose prose-invert max-w-none text-gray-300 text-sm leading-relaxed">
                    <ReactMarkdown>{result.explanation}</ReactMarkdown>
                  </div>
                </div>

                {/* Visual Proof */}
                {result.proof &&
                  result.proof.data &&
                  result.proof.data.length > 0 && (
                    <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6">
                      <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <BarChart3 size={14} /> Visual Proof:{" "}
                        {result.proof.title}
                      </h4>

                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={result.proof.data}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#333"
                              vertical={false}
                            />
                            <XAxis
                              dataKey={result.proof.xAxis}
                              stroke="#666"
                              fontSize={12}
                            />
                            <YAxis stroke="#666" fontSize={12} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#111",
                                border: "1px solid #333",
                                borderRadius: "8px",
                              }}
                              itemStyle={{ color: "#00C9B7" }}
                            />
                            <Bar
                              dataKey={result.proof.yAxis}
                              fill="#00C9B7"
                              radius={[4, 4, 0, 0]}
                            >
                              {result.proof.data.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
              </motion.div>
            )}

            {activeSubTab === "know" && manualResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-8">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 size={14} /> Visual Proof:{" "}
                      {selectedMetric.replace("_", " ").toUpperCase()}
                    </h4>
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-1 bg-white/5 rounded text-[10px] font-bold text-gray-400 uppercase">
                        League Avg: {manualResult.leagueAvg}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">
                          {manualResult.playerA.name}
                        </span>
                        <span className="text-2xl font-black text-aurora-teal">
                          {manualResult.playerA.value}
                        </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(manualResult.playerA.value / Math.max(manualResult.playerA.value, manualResult.playerB.value)) * 100}%`,
                          }}
                          className="h-full bg-aurora-teal"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">
                          Impact vs Avg:
                        </span>
                        <span
                          className={`text-[10px] font-black ${manualResult.playerA.value > manualResult.leagueAvg ? "text-aurora-teal" : "text-red-500"}`}
                        >
                          {manualResult.playerA.value > manualResult.leagueAvg
                            ? "+"
                            : ""}
                          {(
                            ((manualResult.playerA.value -
                              manualResult.leagueAvg) /
                              manualResult.leagueAvg) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">
                          {manualResult.playerB.name}
                        </span>
                        <span className="text-2xl font-black text-metallic-gold">
                          {manualResult.playerB.value}
                        </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${(manualResult.playerB.value / Math.max(manualResult.playerA.value, manualResult.playerB.value)) * 100}%`,
                          }}
                          className="h-full bg-metallic-gold"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">
                          Impact vs Avg:
                        </span>
                        <span
                          className={`text-[10px] font-black ${manualResult.playerB.value > manualResult.leagueAvg ? "text-aurora-teal" : "text-red-500"}`}
                        >
                          {manualResult.playerB.value > manualResult.leagueAvg
                            ? "+"
                            : ""}
                          {(
                            ((manualResult.playerB.value -
                              manualResult.leagueAvg) /
                              manualResult.leagueAvg) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setActiveSubTab("ask");
                        setQuery(
                          `Compare ${playerA} and ${playerB} on ${selectedMetric.replace("_", " ")} in ${format} format.`,
                        );
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-widest text-white transition-all"
                    >
                      <Zap size={14} className="text-aurora-teal" />
                      Explain this verdict
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <History size={14} /> Recent Verdicts
            </h3>
            <div className="space-y-3">
              {recentVerdicts.length > 0 ? (
                recentVerdicts.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(v)}
                    className="w-full text-left p-3 bg-black/40 hover:bg-white/5 border border-white/5 rounded-xl transition-all group"
                  >
                    <div className="text-xs text-gray-300 line-clamp-2 mb-1 group-hover:text-white transition-colors">
                      {v}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-600 uppercase">
                        Analysis
                      </span>
                      <ChevronRight
                        size={12}
                        className="text-gray-600 group-hover:text-aurora-teal transition-colors"
                      />
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <Search
                    size={24}
                    className="mx-auto text-gray-700 mb-2 opacity-20"
                  />
                  <p className="text-[10px] font-bold text-gray-600 uppercase">
                    No history yet
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-aurora-teal/10 to-purple-500/10 border border-white/10 rounded-2xl p-6 shadow-xl">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
              <Trophy size={14} className="text-metallic-gold" /> Pro Tip
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Use the{" "}
              <span className="text-aurora-teal font-bold">Know Anything</span>{" "}
              tab to find raw data trends, then use{" "}
              <span className="text-aurora-teal font-bold">
                Explain this verdict
              </span>{" "}
              to get the AI's deep analysis on that specific data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
