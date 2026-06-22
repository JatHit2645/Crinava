import React from "react";
import { motion } from "motion/react";
import { Activity, TrendingUp, Zap, Clock, MapPin } from "lucide-react";

interface MatchCardProps {
  match: any;
  onPredict: (match: any) => void;
}

/**
 * Renders a live match card with teams, statistics, venue, and a predict action.
 * @example
 * MatchCard(match, onPredict)
 * <MatchCard match={match} onPredict={handlePredict} />
 * @param {{Object}} match - Match data containing team names, abbreviations, format, probabilities, momentum, status, and venue.
 * @param {{Function}} onPredict - Callback invoked when the Predict button is clicked with the current match object.
 * @returns {JSX.Element} A stylized match card component.
 **/
export const MatchCard: React.FC<MatchCardProps> = ({ match, onPredict }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="glass-card p-8 group relative overflow-hidden"
    >
      {/* Background Decoration */}
      <div className="absolute -top-12 -right-12 size-32 bg-aurora/5 rounded-full blur-3xl group-hover:bg-aurora/10 transition-colors"></div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="badge-live">Live Telemetry</div>
        <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-widest">
          <Clock className="size-3" />
          {match.status === "LIVE" ? "In Progress" : "Upcoming"}
        </div>
      </div>

      {/* Match Info */}
      <div className="flex items-center justify-between gap-8 mb-10">
        <div className="flex-1 text-center">
          <div className="size-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
            <span className="text-2xl font-bold text-white">
              {match.team1_short}
            </span>
          </div>
          <div className="font-bold text-white text-lg">{match.team1}</div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="text-3xl font-black text-gradient-aurora">VS</div>
          <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-white/40 uppercase tracking-widest">
            {match.format}
          </div>
        </div>

        <div className="flex-1 text-center">
          <div className="size-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
            <span className="text-2xl font-bold text-white">
              {match.team2_short}
            </span>
          </div>
          <div className="font-bold text-white text-lg">{match.team2}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-white/3 border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
            <TrendingUp className="size-3 text-aurora" />
            Win Probability
          </div>
          <div className="text-xl font-mono font-bold text-white">
            {match.win_prob_1}%{" "}
            <span className="text-xs text-white/40">vs</span> {match.win_prob_2}
            %
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white/3 border border-white/5 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest">
            <Activity className="size-3 text-imperial" />
            Momentum
          </div>
          <div className="text-xl font-mono font-bold text-white">
            {match.momentum}%{" "}
            <span className="text-xs text-white/40">Shift</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-widest">
          <MapPin className="size-3" />
          {match.venue}
        </div>
        <button
          onClick={() => onPredict(match)}
          className="btn-primary py-2.5 px-6 group/btn"
        >
          <span className="flex items-center gap-2">
            Predict
            <Zap className="size-4 group-hover/btn:scale-110 transition-transform" />
          </span>
        </button>
      </div>
    </motion.div>
  );
};
