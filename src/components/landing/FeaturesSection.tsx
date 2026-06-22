import React from "react";
import { motion } from "motion/react";
import { Target, Cpu, TrendingUp, Users, ShieldCheck, Zap } from "lucide-react";

const features = [
  {
    icon: <Target className="size-6" />,
    title: "Oracle Engine",
    description:
      "AI-driven predictive analytics with 94.2% historical accuracy across all formats.",
    color: "aurora",
  },
  {
    icon: <Cpu className="size-6" />,
    title: "Monte Carlo Simulations",
    description:
      "Run 10,000+ match scenarios in seconds to identify high-probability outcomes.",
    color: "imperial",
  },
  {
    icon: <TrendingUp className="size-6" />,
    title: "Momentum Flow",
    description:
      "Real-time telemetry tracking psychological and physical momentum shifts.",
    color: "aurora",
  },
  {
    icon: <Users className="size-6" />,
    title: "Smart XI Optimizer",
    description:
      "Algorithmic team selection based on pitch conditions and player matchups.",
    color: "imperial",
  },
  {
    icon: <ShieldCheck className="size-6" />,
    title: "Risk Assessment",
    description:
      "Advanced volatility metrics to protect your strategy from outlier events.",
    color: "aurora",
  },
  {
    icon: <Zap className="size-6" />,
    title: "Instant Telemetry",
    description:
      "Sub-second data updates from global match feeds directly to your dashboard.",
    color: "imperial",
  },
];

export const FeaturesSection: React.FC = () => {
  return (
    <section id="oracle" className="py-24 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-8">
          <div className="max-w-2xl">
            <div className="badge-live mb-6">Core Capabilities</div>
            <h2 className="text-section md:text-5xl font-bold tracking-tighter text-gradient-white mb-6">
              THE FUTURE OF <br />
              <span className="text-gradient-aurora">
                CRICKET INTELLIGENCE.
              </span>
            </h2>
            <p className="text-white/50 text-lg leading-relaxed">
              Crinava isn't just a dashboard. It's a high-performance analytical
              environment designed for those who demand absolute precision.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-bold text-aurora uppercase tracking-widest mb-1">
                Processing Power
              </div>
              <div className="text-2xl font-mono font-bold">2.4 TFLOPS</div>
            </div>
            <div className="w-px h-12 bg-white/10"></div>
            <div className="text-right">
              <div className="text-sm font-bold text-imperial uppercase tracking-widest mb-1">
                Data Points
              </div>
              <div className="text-2xl font-mono font-bold">14.8M+</div>
            </div>
          </div>
        </div>

        <div className="card-grid">
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className={`glass-card p-8 group hover:border-${feature.color}/40`}
            >
              <div
                className={`size-14 rounded-2xl bg-${feature.color}/10 border border-${feature.color}/20 flex items-center justify-center text-${feature.color} mb-8 group-hover:scale-110 transition-transform duration-500`}
              >
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-4 text-white group-hover:text-aurora transition-colors">
                {feature.title}
              </h3>
              <p className="text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
