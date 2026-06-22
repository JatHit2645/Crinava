import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useVerdictStore } from "../store/verdictStore";
import { ArrowLeft, Target, Zap } from "lucide-react";
import { motion } from "motion/react";

interface PlayerProfileProps {
  playerId: string; // This is actually the player's name from the scorecard
  onBack: () => void;
}

export const PlayerProfile: React.FC<PlayerProfileProps> = ({
  playerId,
  onBack,
}) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { addPlayer, removePlayer, selectedPlayerIds } = useVerdictStore();
  const isAdded = selectedPlayerIds.includes(playerId);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        // 1. Get player ID from players table using EXACT name match
        // We also fetch matches_played from career stats to resolve name clashes (pick the most active player)
        const { data: playersData, error: playersError } = await supabase
          .from("players")
          .select(
            `
            player_id, 
            player_name, 
            batting_style, 
            bowling_style,
            player_career_stats (matches_played)
          `,
          )
          .eq("player_name", playerId.trim());

        if (playersError) throw playersError;

        if (playersData && playersData.length > 0) {
          // Sort by matches_played descending to pick the most "relevant" player if names clash
          const sortedPlayers = [...playersData].sort((a: any, b: any) => {
            const aMatches = a.player_career_stats?.[0]?.matches_played || 0;
            const bMatches = b.player_career_stats?.[0]?.matches_played || 0;
            return bMatches - aMatches;
          });

          const [playerInfo] = sortedPlayers;
          const dbPlayerId = playerInfo.player_id;

          // 2. Fetch pre-calculated career stats using the exact player_id
          const { data: careerStats, error: careerError } = await supabase
            .from("player_career_stats")
            .select("*")
            .eq("player_id", dbPlayerId)
            .single();

          if (careerError && careerError.code !== "PGRST116") throw careerError;

          if (
            careerStats &&
            (careerStats.total_runs > 0 || careerStats.total_wickets > 0)
          ) {
            setStats({
              name: playerInfo.player_name,
              battingStyle: playerInfo.batting_style,
              bowlingStyle: playerInfo.bowling_style,
              runs: careerStats.total_runs,
              ballsFaced: careerStats.total_balls_faced,
              average:
                careerStats.total_dismissals > 0
                  ? (
                      careerStats.total_runs / careerStats.total_dismissals
                    ).toFixed(2)
                  : careerStats.total_runs.toFixed(2),
              strikeRate:
                careerStats.total_balls_faced > 0
                  ? (
                      (careerStats.total_runs / careerStats.total_balls_faced) *
                      100
                    ).toFixed(2)
                  : "0.00",
              wickets: careerStats.total_wickets,
              bowlingAverage:
                careerStats.total_wickets > 0
                  ? (
                      careerStats.total_runs_conceded /
                      careerStats.total_wickets
                    ).toFixed(2)
                  : "N/A",
              economy:
                careerStats.total_balls_bowled > 0
                  ? (
                      careerStats.total_runs_conceded /
                      (careerStats.total_balls_bowled / 6)
                    ).toFixed(2)
                  : "0.00",
              overs: `${Math.floor(careerStats.total_balls_bowled / 6)}.${careerStats.total_balls_bowled % 6}`,
              ballsBowled: careerStats.total_balls_bowled,
            });
          } else {
            // Fallback: Aggregate from deliveries
            console.log(
              "DEBUG: Career stats empty, aggregating from deliveries for:",
              dbPlayerId,
            );
            const { data: deliveries, error: delError } = await supabase
              .from("deliveries")
              .select(
                "runs_batter, runs_total, wicket_kind, batter_id, bowler_id",
              )
              .or(`batter_id.eq.${dbPlayerId},bowler_id.eq.${dbPlayerId}`);

            if (delError) throw delError;

            let runs = 0,
              ballsFaced = 0,
              wickets = 0,
              ballsBowled = 0,
              runsConceded = 0;
            deliveries?.forEach((d) => {
              if (d.batter_id === dbPlayerId) {
                runs += d.runs_batter || 0;
                ballsFaced += 1;
              }
              if (d.bowler_id === dbPlayerId) {
                ballsBowled += 1;
                runsConceded += d.runs_total || 0;
                if (d.wicket_kind && d.wicket_kind !== "run out") wickets += 1;
              }
            });

            setStats({
              name: playerInfo.player_name,
              battingStyle: playerInfo.batting_style,
              bowlingStyle: playerInfo.bowling_style,
              runs,
              ballsFaced,
              average:
                ballsFaced > 0 ? (runs / (ballsFaced / 6)).toFixed(2) : "0.00", // Simplified
              strikeRate:
                ballsFaced > 0
                  ? ((runs / ballsFaced) * 100).toFixed(2)
                  : "0.00",
              wickets,
              bowlingAverage:
                wickets > 0 ? (runsConceded / wickets).toFixed(2) : "N/A",
              economy:
                ballsBowled > 0
                  ? (runsConceded / (ballsBowled / 6)).toFixed(2)
                  : "0.00",
              overs: `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`,
              ballsBowled,
            });
          }
        } else {
          console.warn("DEBUG: Player not found in DB:", playerId);
          // Fallback if player not found in DB
          setStats({
            name: playerId,
            battingStyle: "Unknown",
            bowlingStyle: "Unknown",
            runs: 0,
            ballsFaced: 0,
            average: "0.00",
            strikeRate: "0.00",
            wickets: 0,
            bowlingAverage: "N/A",
            economy: "0.00",
            overs: "0.0",
          });
        }
      } catch (error) {
        console.error("Error fetching player stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [playerId]);

  const handleVerdictToggle = () => {
    if (isAdded) {
      removePlayer(playerId);
    } else {
      addPlayer(playerId);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex justify-center items-center py-20">
        <div className="size-8 border-2 border-metallic-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-4xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-black/40 p-6 rounded-2xl border border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="p-3 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="size-6 text-white" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic">
              {stats?.name}
            </h1>
            <div className="flex gap-4 mt-2 text-sm text-gray-400 font-medium">
              <span>{stats?.battingStyle}</span>
              <span>•</span>
              <span>{stats?.bowlingStyle}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleVerdictToggle}
          className={`px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${
            isAdded
              ? "bg-white/10 text-white border border-white/20 hover:bg-red-500/20 hover:text-red-500 hover:border-red-500/50"
              : "bg-metallic-gold text-black hover:bg-yellow-400 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
          }`}
        >
          {isAdded ? "Remove from Verdict" : "Add to Verdict"}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Batting Stats */}
        <div className="bg-black/40 p-6 rounded-2xl border border-white/10 backdrop-blur-md space-y-6">
          <div className="flex items-center gap-3 text-metallic-gold">
            <Target className="size-5" />
            <h2 className="text-lg font-black uppercase tracking-widest">
              Batting Career
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-xl">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                Total Runs
              </div>
              <div className="text-3xl font-black text-white">
                {stats?.runs}
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                Strike Rate
              </div>
              <div className="text-3xl font-black text-white">
                {stats?.strikeRate}
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                Average
              </div>
              <div className="text-3xl font-black text-white">
                {stats?.average}
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                Balls Faced
              </div>
              <div className="text-3xl font-black text-white">
                {stats?.ballsFaced}
              </div>
            </div>
          </div>
        </div>

        {/* Bowling Stats */}
        <div className="bg-black/40 p-6 rounded-2xl border border-white/10 backdrop-blur-md space-y-6">
          <div className="flex items-center gap-3 text-aurora-teal">
            <Zap className="size-5" />
            <h2 className="text-lg font-black uppercase tracking-widest">
              Bowling Career
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 p-4 rounded-xl">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                Wickets
              </div>
              <div className="text-3xl font-black text-white">
                {stats?.wickets}
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                Economy
              </div>
              <div className="text-3xl font-black text-white">
                {stats?.economy}
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                Average
              </div>
              <div className="text-3xl font-black text-white">
                {stats?.bowlingAverage}
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-xl">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">
                Overs
              </div>
              <div className="text-3xl font-black text-white">
                {stats?.overs}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
