import { supabase } from "../lib/supabaseServer";

/**
* Fetches and logs players who have a non-null bowling style from the players table.
* @example
* listEnrichedPlayers()
* undefined
* @returns {Promise<void>} A promise that resolves when the enriched players have been fetched and logged.
**/
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
