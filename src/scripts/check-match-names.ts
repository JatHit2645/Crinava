import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

/**
* Fetches a single match record from Supabase and logs basic scorecard information for inspection.
* @example
* checkMatchScorecard()
* undefined
* @param {void} - This function does not accept any arguments.
* @returns {Promise<void>} Resolves when the match data is logged, or returns early if an error occurs.
**/
async function checkMatchScorecard() {
  const { data: match, error } = await supabase
    .from("matches")
    .select("match_id, raw_info")
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching match:", error);
    return;
  }

  const rawInfo =
    typeof match.raw_info === "string"
      ? JSON.parse(match.raw_info)
      : match.raw_info;
  const players = rawInfo.info?.players || {};
  console.log("Match ID:", match.match_id);
  console.log("Players in info:", players);

  const [firstInning] = rawInfo.innings;
  const firstOver = firstInning.overs?.[0] || firstInning.deliveries?.[0];
  console.log(
    "Sample delivery batter:",
    firstOver?.deliveries?.[0]?.batter || firstOver?.batter,
  );
}

checkMatchScorecard();
