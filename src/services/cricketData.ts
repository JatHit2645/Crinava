// CRINAVA_TELEMETRY_UPGRADE_REVISION_1
import { supabase } from "../lib/supabaseClient";
import { Database } from "../types/database";

export type Delivery = Database["public"]["Tables"]["deliveries"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type PlayerStats =
  Database["public"]["Tables"]["player_stats_summary"]["Row"];

export interface LiveExtras {
  total: number;
  byes: number;
  legByes: number;
  wides: number;
  noBalls: number;
  penalty?: number;
}

export interface LivePlayerLine {
  id?: string;
  n?: string;
  r?: string | number;
  b?: string | number;
  sr?: string | number;
  o?: string | number;
  m?: string | number;
  w?: string | number;
  e?: string | number;
}

export interface LiveScorecardTelemetry {
  striker?: LivePlayerLine;
  non_striker?: LivePlayerLine;
  bowler?: LivePlayerLine;
  extras?: LiveExtras;
  recent_balls?: string[];
  dismissal_timeline?: any[];
}

export interface LiveWinPredictor {
  teamA?: string;
  teamB?: string;
  batting_team?: string;
  bowling_team?: string;
  winA?: number;
  winB?: number;
  win_probability?: number;
  innings_no?: number;
  target?: number;
  runs_needed?: number;
  balls_remaining?: number;
  wickets_left?: number;
}

export interface LiveCommentaryPacket {
  match_id?: string;
  event_key?: string;
  over_ball: string;
  runs_scored: string;
  score: string;
  commentary: string;
  raw_commentary?: string;
  type?: string;
  flavor?: string[];
  telemetry?: LiveScorecardTelemetry;
  win_predictor?: LiveWinPredictor;
  scorecard_cache?: any;
  timestamp?: number;
}

/**
 * Service to interact with the Supabase Cricket Data
 */
export const CricketDataService = {
  /**
   * Fetch all deliveries for a specific match
   */
  async getDeliveriesForMatch(matchId: number): Promise<Delivery[]> {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("match_id", matchId)
      .order("innings_no", { ascending: true })
      .order("over_no", { ascending: true })
      .order("ball_no", { ascending: true });

    if (error) {
      console.error(`Error fetching deliveries for match ${matchId}:`, error);
      return [];
    }
    return data || [];
  },

  /**
   * Get match metadata by ID
   */
  async getMatch(matchId: number): Promise<Match | null> {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("match_id", matchId)
      .single();

    if (error) {
      console.error(`Error fetching match ${matchId}:`, error);
      return null;
    }
    return data;
  },

  /**
   * Get recent matches
   */
  async getRecentMatches(limit = 10): Promise<Match[]> {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("match_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent matches:", error);
      return [];
    }
    return data || [];
  },

  /**
   * Get advanced stats summary for a player
   */
  async getPlayerStatsSummary(playerId: string): Promise<PlayerStats | null> {
    const { data, error } = await supabase
      .from("player_stats_summary")
      .select("*")
      .eq("player_id", playerId)
      .single();

    if (error) {
      console.error(`Error fetching stats for player ${playerId}:`, error);
      return null;
    }
    return data;
  },

  /**
   * Get volume stats (total runs, boundaries, etc) for a player
   */
  async getPlayerVolumeStats(playerId: string, matchType = "T20") {
    const { data, error } = await supabase
      .from("player_volume_stats")
      .select("*")
      .eq("player_id", playerId)
      .eq("match_type", matchType)
      .single();

    if (error) {
      console.error(
        `Error fetching volume stats for player ${playerId}:`,
        error,
      );
      return null;
    }
    return data;
  },
};
