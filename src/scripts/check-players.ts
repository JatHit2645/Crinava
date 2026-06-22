import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
* Checks the players table by logging a sample of players and the total player count.
* @example
* checkPlayers()
* undefined
* @returns {Promise<void>} Resolves after logging player data or errors to the console.
**/
async function checkPlayers() {
  console.log("Checking players table...");
  const { data: players, error } = await supabase
    .from("players")
    .select("player_id, player_name")
    .limit(5);

  if (error) {
    console.error("Error fetching players:", error);
  } else {
    console.log("Sample players:", players);
  }

  const { count, error: countError } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Error counting players:", countError);
  } else {
    console.log("Total players:", count);
  }
}

checkPlayers();
