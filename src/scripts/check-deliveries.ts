import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

async function checkDeliveries() {
  const playerId = "dcce6f09";
  console.log(`Checking deliveries for "${playerId}"...`);
  const { data, error } = await supabase
    .from("deliveries")
    .select("runs_batter, batter_id, bowler_id")
    .or(`batter_id.eq.${playerId},bowler_id.eq.${playerId}`)
    .limit(5);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Results:", data);
  }
}

checkDeliveries();
