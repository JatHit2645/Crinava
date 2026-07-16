import { createClient } from "@supabase/supabase-js";

const projectId =
  process.env.VITE_SUPABASE_PROJECT_ID ||
  import.meta.env?.VITE_SUPABASE_PROJECT_ID;

const supabaseUrl = projectId
  ? `https://${projectId}.supabase.co`
  : (process.env.VITE_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL);
const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "CRITICAL: Missing Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)",
  );
}

export const supabase = createClient(
  supabaseUrl || "http://placeholder.url",
  supabaseAnonKey || "placeholder-key",
);
