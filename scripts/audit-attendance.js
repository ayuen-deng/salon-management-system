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
  console.log('--- AUDITING ATTENDANCE RECORDS IN DB ---');
  const { data: att } = await client
    .from('attendance')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('Recent 20 attendance rows:', JSON.stringify(att, null, 2));

  console.log('\n--- PETER ATTENDANCE ROWS ---');
  const peterId = 'c0000000-0000-0000-0000-000000000007';
  const { data: peterAtt } = await client
    .from('attendance')
    .select('*')
    .eq('staff_user_id', peterId)
    .order('business_date', { ascending: false });
  console.log('Peter attendance:', peterAtt);

  console.log('\n--- ALL ACTIVE USERS ---');
  const { data: users } = await client
    .from('app_user')
    .select('id, display_name, role, status')
    .eq('status', 'active');
  console.log('Active users count:', users?.length, users?.map(u => `${u.display_name} (${u.role})`));
}

run().catch(console.error);
