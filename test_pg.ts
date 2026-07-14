import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.COCKROACH_URL
});

pool.query("SELECT * FROM debates LIMIT 1")
  .then(res => console.log("Success:", res.rows))
  .catch(err => console.error("Error:", err.message))
  .finally(() => pool.end());
