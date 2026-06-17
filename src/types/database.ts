export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      deliveries: {
        Row: {
          delivery_id: number;
          match_id: number | null;
          innings_no: number | null;
          over_no: number | null;
          ball_no: number | null;
          batter_id: string | null;
          bowler_id: string | null;
          non_striker_id: string | null;
          runs_batter: number | null;
          runs_extras: number | null;
          runs_total: number | null;
          wicket_player_out: string | null;
          wicket_kind: string | null;
          extras_type: Json | null;
          wicket_fielder_id: string | null;
        };
      };
      matches: {
        Row: {
          match_id: number;
          season: string | null;
          match_type: string | null;
          match_type_number: number | null;
          event_name: string | null;
          event_match_number: string | null;
          balls_per_over: number | null;
          city: string | null;
          venue: string | null;
          toss_winner_id: number | null;
          toss_decision: string | null;
          outcome_result: string | null;
          outcome_winner_id: number | null;
          player_of_match: string[] | null;
          match_date: string | null;
          match_referee_id: number | null;
          victory_margin: string | null;
          raw_info: Json | null;
          team_1: string | null;
          team_2: string | null;
        };
      };
      player_stats_summary: {
        Row: {
          player_id: string;
          dimension_1_consistency: Json | null;
          dimension_3_trajectory: Json | null;
          dimension_4_clutch: Json | null;
          dimension_5_impact: Json | null;
          updated_at: string | null;
        };
      };
      player_volume_stats: {
        Row: {
          player_id: string;
          match_type: string;
          b1_matches: number | null;
          b2_innings: number | null;
          b3_balls: number | null;
          b4_runs: number | null;
          b5_dismissals: number | null;
          b14_boundaries: number | null;
          b9_sixes: number | null;
        };
      };
    };
  };
}
