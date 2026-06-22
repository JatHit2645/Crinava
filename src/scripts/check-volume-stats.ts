import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

/**
 * Checks and logs a sample record from the player_volume_stats table.
 * @example
 * checkVolumeStats()
 * undefined
 * @returns {Promise<void>} A promise that resolves after logging the table sample or an error.
 */
async function checkVolumeStats() {
  console.log("Checking player_volume_stats...");
  const { data, error } = await supabase
    .from("player_volume_stats")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Sample data:", data);
  }
}

checkVolumeStats();
