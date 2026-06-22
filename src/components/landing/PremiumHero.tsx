import React from "react";
import { motion } from "motion/react";
import { Play, ArrowRight, Shield, Zap, Globe } from "lucide-react";

interface PremiumHeroProps {
  onGetStarted: () => void;
}

/**
 * Renders a premium hero section for the landing page with animated branding, call-to-action buttons, and trust indicators.
 * @example
 * onGetStarted()
 * undefined
 * @param {Function} onGetStarted - Callback invoked when the primary "Launch Oracle Engine" button is clicked.
 * @returns {JSX.Element} The rendered landing page hero section.
 */
export const PremiumHero: React.FC<PremiumHeroProps> = ({ onGetStarted }) => {
  return (
    <section className="relative pt-40 pb-24 px-6 overflow-hidden">
      {/* Background Decoration */}
      <div className="glow-orb glow-orb-aurora w-[600px] h-[600px] top-[-200px] left-[-100px]"></div>
      <div className="glow-orb glow-orb-imperial w-[500px] h-[500px] bottom-[-100px] right-[-100px]"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col items-center text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="badge-live mb-8"
          >
            v2.5 Oracle Engine Live
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-display md:text-[84px] font-extrabold tracking-tighter leading-[0.95] mb-8 text-gradient-white"
          >
            PRECISION <br />
            <span className="text-gradient-aurora">INTELLIGENCE.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="max-w-2xl text-lg md:text-xl text-white/60 leading-relaxed mb-12"
          >
            The world's most advanced AI-driven cricket analytics platform.
            Harnessing Monte Carlo simulations and real-time telemetry to
            predict the unpredictable.
          </motion.p>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center gap-6"
          >
            <button onClick={onGetStarted} className="btn-primary group">
              <span className="flex items-center gap-2">
                Launch Oracle Engine
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button className="btn-secondary flex items-center gap-2 group">
              <div className="size-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-aurora/20 transition-colors">
                <Play className="size-3 fill-white group-hover:fill-aurora transition-colors" />
              </div>
              Watch Simulation
            </button>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.2, delay: 1 }}
            className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-700"
          >
            <div className="flex items-center gap-3">
              <Shield className="size-6" />
              <span className="text-xs font-bold tracking-widest uppercase">
                Encrypted
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="size-6" />
              <span className="text-xs font-bold tracking-widest uppercase">
                Real-time
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="size-6" />
              <span className="text-xs font-bold tracking-widest uppercase">
                Global Data
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-6 border-2 border-white rounded-sm"></div>
              <span className="text-xs font-bold tracking-widest uppercase">
                Verified
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
