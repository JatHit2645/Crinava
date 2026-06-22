import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

/**
 * Checks and logs career stats for a specific player ID from the database.
 * @example
 * checkCareerStats()
 * undefined
 * @returns {Promise<void>} Resolves when the career stats query has been completed and logged.
 **/
async function checkCareerStats() {
  const playerId = "dcce6f09";
  console.log(`Checking career stats for "${playerId}"...`);
  const { data, error } = await supabase
    .from("player_career_stats")
    .select("*")
    .eq("player_id", playerId);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Results:", data);
  }
}

checkCareerStats();
