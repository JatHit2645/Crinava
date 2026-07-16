import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
// For bypassing RLS, we prefer the service role key if available
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// A constant UUID for your local test environment
const LOCAL_TEST_UUID = "00000000-0000-0000-0000-000000000000";

async function seedTestUser() {
  console.log(`Seeding local test user with UUID: ${LOCAL_TEST_UUID}`);

  // 1. Insert into auth.users (if using a service role key and testing fully locally). 
  // If not using service role key, we just insert directly into profiles assuming RLS allows or bypassing.
  
  // Note: auth.users insertion usually requires the service_role key or Admin API. 
  // For local testing without auth, you can temporarily disable the foreign key from profiles -> auth.users
  // OR use a real user's UUID from your Supabase auth table.
  
  // Assuming you want to just insert a profile for testing achievements.
  // If profiles.id has a strict foreign key to auth.users, this might fail unless the user exists in auth.users.
  
  const { error } = await supabase.from('profiles').upsert({
    id: LOCAL_TEST_UUID,
    username: 'local_tester',
    cricket_iq: 100,
    crinava_coins: 500,
    career_path: 'Rookie',
    badge_tier: 'bronze',
    badge_progress: 0
  });

  if (error) {
    console.error("Error inserting test profile. Make sure RLS allows this or you are using the Service Role Key. Error:", error.message);
    if (error.message.includes("foreign key constraint")) {
      console.log("\n💡 FIX: The 'profiles' table has a foreign key to 'auth.users'.");
      console.log("To fix this, either:");
      console.log("1. Sign up a real test user via the UI, grab their UUID from the Supabase Dashboard, and use it instead.");
      console.log("2. OR Temporarily drop the foreign key constraint for local testing.");
    }
  } else {
    console.log("✅ Local test profile created successfully!");
    console.log("You can now hardcode this UUID in your frontend for testing, e.g.:");
    console.log(`const MOCK_USER_ID = "${LOCAL_TEST_UUID}";`);
  }
}

seedTestUser();
