import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function fixRLS() {
  console.log("Applying RLS policies...");
  
  // This is a simplified way to apply policies. 
  // In a real Supabase environment, you would run SQL via the Supabase dashboard or a migration script.
  // Since I cannot run raw SQL directly here, I will ask the user to run this in their Supabase SQL Editor.
  
  const sql = `
    -- Enable RLS
    ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
    ALTER TABLE players ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Allow public read access" ON deliveries FOR SELECT USING (true);
    CREATE POLICY "Allow public read access" ON matches FOR SELECT USING (true);
    CREATE POLICY "Allow public read access" ON players FOR SELECT USING (true);

    -- Grant permissions
    GRANT SELECT ON deliveries TO anon;
    GRANT SELECT ON matches TO anon;
    GRANT SELECT ON players TO anon;
  `;
  
  console.log("Please run the following SQL in your Supabase SQL Editor:");
  console.log(sql);
}

async function checkDeliveriesSchema() {
    console.log("\nChecking deliveries schema...");
    const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .limit(1);
    
    if (error) console.error("Error:", error);
    else if (data && data.length > 0) console.log("Deliveries columns:", Object.keys(data[0]));
    else console.log("No data in deliveries");
}

fixRLS();
checkDeliveriesSchema();
