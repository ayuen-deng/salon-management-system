const fs = require('fs');
const dotenv = fs.readFileSync('.env.local', 'utf8');
const env = {};
dotenv.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});
const { createClient } = require('@supabase/supabase-js');
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: rows, error } = await client
    .from('attendance')
    .select('staff_user_id, late, clock_in, clock_out, app_user(display_name, role)')
    .eq('location_id', 'b0000000-0000-0000-0000-000000000001')
    .eq('business_date', '2026-11-02');
  console.log('Query attendance for 2026-11-02:', rows, error);
}

run().catch(console.error);
