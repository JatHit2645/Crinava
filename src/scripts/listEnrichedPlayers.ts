import { supabase } from "../lib/supabaseServer";

async function listEnrichedPlayers() {
  console.log("Fetching enriched players...");
  const { data, error } = await supabase
    .from("players")
    .select("player_name, bowling_style")
    .not("bowling_style", "is", null);

  if (error) {
    console.error("Error fetching enriched players:", error);
    return;
  }

  console.log(`Found ${data?.length || 0} enriched players:`);
  console.table(data);
}

listEnrichedPlayers();
