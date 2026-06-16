import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

async function testWebsiteQuery() {
  console.log("🔍 Running Dashboard's Series Query...");

  const pool = new Pool({
    connectionString: process.env.COCKROACH_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    
    // The exact query from cockroachService.ts
    const query = `
      SELECT 
        event_name, 
        season, 
        MIN(match_date) as start_date, 
        MAX(match_date) as end_date, 
        COUNT(DISTINCT match_id) as match_count,
        match_type
      FROM match_deliveries_v3
      WHERE event_name IS NOT NULL
      GROUP BY event_name, season, match_type
      ORDER BY MAX(match_date) DESC
      LIMIT 10;
    `;

    console.log("📡 Sending query to CockroachDB...");
    const res = await client.query(query);
    
    if (res.rows.length > 0) {
        console.log("✅ SUCCESS! Found Series Data:");
        console.table(res.rows);
    } else {
        console.log("⚠️ Query returned 0 rows! (Is event_name actually populated?)");
        const check = await client.query("SELECT event_name FROM match_deliveries_v3 WHERE event_name IS NOT NULL LIMIT 1");
        console.log("Check for populated event_name:", check.rows.length > 0 ? "Found one!" : "STILL ALL NULL!");
    }
    
    client.release();
    process.exit(0);
  } catch (err: any) {
    console.error("❌ QUERY FAILED!");
    console.error("Error Message:", err.message);
    process.exit(1);
  }
}

testWebsiteQuery();
