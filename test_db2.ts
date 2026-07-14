import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const s = createClient(process.env.BLOG_SUPABASE_URL, process.env.BLOG_SUPABASE_KEY);
  console.log("URL:", process.env.BLOG_SUPABASE_URL);
  try {
    const { data, error } = await s.from("debates").select("*").limit(1);
    if (error) console.error("Supabase Error:", error);
    else console.log("Success! Fetched:", data);
  } catch (e) {
    console.error("Global Error:", e);
  }
}
main();
