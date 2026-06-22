import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

/**
 * Searches for a player by name in the players table and logs the results.
 * @example
 * searchPlayer()
 * [{ player_name: "DA Warner", ... }]
 * @returns {Promise<void>} A promise that resolves after the search completes and results are logged.
 **/
async function searchPlayer() {
  const name = "DA Warner";
  console.log(`Searching for "${name}"...`);
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .ilike("player_name", name);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Results:", data);
  }
}

searchPlayer();
