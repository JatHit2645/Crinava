import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "CRITICAL: Missing Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)",
  );
}

export const supabase = createClient(
  supabaseUrl || "http://placeholder.url",
  supabaseAnonKey || "placeholder-key",
);
