require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.BLOG_SUPABASE_URL, process.env.BLOG_SUPABASE_KEY);

async function test() {
  try {
    const { data, error } = await supabase.from('debates').select('*').limit(1);
    console.log('Result:', data, error);
  } catch (err) {
    console.error('Crash:', err);
  }
}
test();
