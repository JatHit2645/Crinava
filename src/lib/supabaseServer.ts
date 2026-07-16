import { createClient } from "@supabase/supabase-js";

const projectId = process.env.VITE_SUPABASE_PROJECT_ID;

const supabaseUrl =
  process.env.BLOG_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  (projectId ? `https://${projectId}.supabase.co` : process.env.VITE_SUPABASE_URL);
const supabaseKey =
  process.env.BLOG_SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

console.log("Initializing supabaseServer with URL:", supabaseUrl);

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "CRITICAL: Missing Supabase environment variables (BLOG_SUPABASE_URL or standard keys)",
  );
}

export const supabase = createClient(
  supabaseUrl || "http://placeholder.url",
  supabaseKey || "placeholder-key",
);
