import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function listTables() {
  console.log("Listing tables (via a hacky way)...");
  // Since we don't have direct access to list tables easily in Supabase client without RPC,
  // we'll try some common ones or use a known error to see hints.
  const tables = [
    "players",
    "matches",
    "deliveries",
    "player_career_stats",
    "player_volume_stats",
    "career_stats",
    "player_stats",
  ];

  /* eslint-disable no-await-in-loop */
  for (const table of tables) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (error) {
      console.log(`Table "${table}": ERROR - ${error.message}`);
    } else {
      console.log(`Table "${table}": EXISTS`);
    }
  }
}

listTables();
