import { supabase } from "../lib/supabaseServer";

export async function getPlayersToEnrich() {
  console.log("getPlayersToEnrich: Starting Supabase query (limit 200)...");
  const startTime = Date.now();
  try {
    // Use a single .or() to catch players where EITHER style is missing/unknown
    const { data: players, error } = await supabase
      .from('players')
      .select('player_id, player_name, bowling_style, batting_style, gender')
      .order('player_id', { ascending: true })
      .or('bowling_style.is.null,bowling_style.eq."",bowling_style.ilike.%Unknown%,bowling_style.ilike.%None%')
      .or('batting_style.is.null,batting_style.eq."",batting_style.ilike.%Unknown%,batting_style.ilike.%N/A%')
      .limit(1000);

    const duration = Date.now() - startTime;
    console.log(`getPlayersToEnrich: Query took ${duration}ms`);

    if (error) {
      console.error("getPlayersToEnrich: Supabase error:", error);
      throw error;
    }
    
    console.log(`getPlayersToEnrich: Successfully fetched ${players?.length || 0} players`);
    return players || [];
  } catch (err) {
    console.error("getPlayersToEnrich: Unexpected error:", err);
    throw err;
  }
}

export async function countPlayersToEnrich() {
  console.log("countPlayersToEnrich: Starting Supabase count query...");
  const { count, error } = await supabase
    .from('players')
    .select('player_id', { count: 'exact', head: true })
    .or('bowling_style.is.null,bowling_style.eq."",bowling_style.ilike.%Unknown%,bowling_style.ilike.%None%')
    .or('batting_style.is.null,batting_style.eq."",batting_style.ilike.%Unknown%,batting_style.ilike.%N/A%');

  if (error) {
    console.error("countPlayersToEnrich error:", error);
    throw error;
  }
  console.log(`countPlayersToEnrich: Successfully counted ${count || 0} players`);
  return count || 0;
}

export async function upsertPlayerStyles(data: { player_id: any, player_name: string, bowling_style: string, batting_style: string }[]) {
  console.log(`upsertPlayerStyles: Upserting ${data.length} players...`);
  const { error } = await supabase
    .from('players')
    .upsert(
      data.map(d => ({
        player_id: d.player_id,
        player_name: d.player_name,
        bowling_style: d.bowling_style,
        batting_style: d.batting_style
      })),
      { onConflict: 'player_id' }
    );

  if (error) {
    console.error("upsertPlayerStyles error:", error);
    throw error;
  }
  console.log("upsertPlayerStyles: Successfully upserted batch");
  return { success: true };
}
