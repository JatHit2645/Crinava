import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from Crinava-main
dotenv.config({ path: path.join(__dirname, 'Crinava-main', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data, error } = await supabase.from('matches').select('*').limit(1);
  if (data && data.length > 0) {
    console.log("Matches columns:", Object.keys(data[0]));
    console.log("Sample match:", JSON.stringify(data[0], null, 2));
  } else {
    console.log("No data in matches or error:", error);
    // If no data, try to get column names via RPC if available or just list all
    const { data: cols, error: colErr } = await supabase.rpc('get_table_columns', { table_name: 'matches' });
    if (cols) console.log("Columns from RPC:", cols);
    else console.log("RPC Error or not found:", colErr);
  }
}
check();
