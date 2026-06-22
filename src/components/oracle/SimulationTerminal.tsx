import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Terminal, Cpu, Zap, Globe, Shield } from "lucide-react";

export const SimulationTerminal: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const simulationLogs = [
    "> Initializing Oracle Engine v2.5...",
    "> Connecting to global telemetry feeds...",
    "> Fetching historical matchup data (14.8M records)...",
    "> Analyzing pitch conditions: Dry, cracks forming...",
    "> Running Monte Carlo simulation (10,000 iterations)...",
    "> Calculating momentum flow: 64.2% shift detected...",
    "> Optimizing Smart XI for current scenario...",
    "> Simulation complete. Accuracy: 94.2%.",
  ];

  useEffect(() => {
    let currentLog = 0;
    const logInterval = setInterval(() => {
      if (currentLog < simulationLogs.length) {
        setLogs((prev) => [...prev, simulationLogs[currentLog]]);
        currentLog++;
        setProgress((prev) => Math.min(prev + 12.5, 100));
      } else {
        clearInterval(logInterval);
      }
    }, 1500);

    return () => clearInterval(logInterval);
  }, []);

  return (
    <section className="py-24 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="badge-live mb-6">Real-time Simulation</div>
            <h2 className="text-section md:text-5xl font-bold tracking-tighter text-gradient-white mb-8">
              THE POWER OF <br />
              <span className="text-gradient-aurora">ORACLE ENGINE.</span>
            </h2>
            <p className="text-white/50 text-lg leading-relaxed mb-12">
              Watch the engine process millions of data points in real-time. Our
              proprietary algorithms analyze everything from wind speed to
              player psychology to give you the ultimate edge.
            </p>

            <div className="space-y-6">
              {[
                {
                  icon: <Cpu className="size-5" />,
                  label: "Neural Processing",
                  value: "Active",
                },
                {
                  icon: <Zap className="size-5" />,
                  label: "Latency",
                  value: "14ms",
                },
                {
                  icon: <Globe className="size-5" />,
                  label: "Global Nodes",
                  value: "128",
                },
                {
                  icon: <Shield className="size-5" />,
                  label: "Data Integrity",
                  value: "99.9%",
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:border-aurora/30 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-aurora group-hover:scale-110 transition-transform">
                      {stat.icon}
                    </div>
                    <span className="text-sm font-bold tracking-widest uppercase text-white/60">
                      {stat.label}
                    </span>
                  </div>
                  <span className="text-sm font-mono font-bold text-aurora">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            {/* Terminal Window */}
            <div className="glass-card bg-void/90 border-white/10 overflow-hidden shadow-glass-lg">
              {/* Terminal Header */}
              <div className="px-6 py-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-red-500/50"></div>
                  <div className="size-3 rounded-full bg-yellow-500/50"></div>
                  <div className="size-3 rounded-full bg-green-500/50"></div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-white/40">
                  <Terminal className="size-3" />
                  ORACLE_SIM_v2.5
                </div>
              </div>

              {/* Terminal Content */}
              <div className="p-8 h-[400px] font-mono text-sm overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                  {logs.map((log, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={
                        log.includes("complete")
                          ? "text-aurora font-bold"
                          : "text-white/60"
                      }
                    >
                      {log}
                    </motion.div>
                  ))}
                  <div className="flex items-center gap-2 text-aurora">
                    <span className="animate-pulse">_</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="px-8 py-6 bg-white/5 border-t border-white/10">
                <div className="flex items-center justify-between mb-3 text-xs font-mono font-bold uppercase tracking-widest">
                  <span className="text-white/60">Processing Simulation</span>
                  <span className="text-aurora">{Math.round(progress)}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full bg-gradient-aurora shadow-aurora"
                  ></motion.div>
                </div>
              </div>
            </div>

            {/* Floating Decoration */}
            <div className="absolute -top-10 -right-10 size-32 bg-aurora/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-10 -left-10 size-32 bg-imperial/10 rounded-full blur-3xl animate-pulse"></div>
          </div>
        </div>
      </div>
    </section>
  );
};
