import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, 'Crinava-main', '.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data, error } = await supabase.from('matches').select('match_id, victory_margin, outcome_result').limit(5);
  if (data) {
    console.log("Sample matches:", JSON.stringify(data, null, 2));
  } else {
    console.log("Error:", error);
  }
}
check();
