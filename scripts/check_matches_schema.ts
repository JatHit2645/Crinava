import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
);

async function check() {
  const { data, error } = await supabase
    .from("deliveries")
    .select("*")
    .limit(1);
  if (data && data.length > 0) {
    console.log("Deliveries columns:", Object.keys(data[0]));
    console.log("Sample delivery:", data[0]);
  } else {
    console.log("No data in deliveries or error:", error);
  }
}
check();
