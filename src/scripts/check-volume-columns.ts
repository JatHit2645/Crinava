import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function checkVolumeColumns() {
  console.log("Checking player_volume_stats columns...");
  // We'll try to get one row even if empty to see columns? No, if empty it won't show.
  // But we can try to insert and rollback or just guess.
  // Actually, let's check if there's any row at all.
  const { data, error } = await supabase
    .from("player_volume_stats")
    .select("*")
    .limit(1);
  if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
  } else {
    console.log("Table is empty, trying to find schema info...");
    // Try to query a common column
    const { error: err2 } = await supabase
      .from("player_volume_stats")
      .select("player_id")
      .limit(1);
    if (!err2) console.log("player_id column EXISTS");
  }
}

checkVolumeColumns();
