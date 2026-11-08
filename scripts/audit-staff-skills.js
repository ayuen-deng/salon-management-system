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
  const { data: allSkills } = await client
    .from('staff_skill')
    .select('service_id, staff_user_id, app_user(display_name), service(name)');

  const { data: services, error: errServices } = await client
    .from('service')
    .select('id, name, active')
    .order('name');
  
  console.log('Total services in DB:', services?.length, errServices);

  const skillCountPerService = {};
  for (const s of allSkills || []) {
    skillCountPerService[s.service_id] = (skillCountPerService[s.service_id] || 0) + 1;
  }

  const unassigned = [];
  const assigned = [];
  for (const s of services || []) {
    const count = skillCountPerService[s.id] || 0;
    if (count === 0) unassigned.push({ id: s.id, name: s.name });
    else assigned.push({ id: s.id, name: s.name, count });
  }

  console.log('Services with NO assignments count:', unassigned.length, 'out of', services?.length);
  console.log('\n--- UNASSIGNED SERVICES (' + unassigned.length + ') ---');
  console.log(unassigned.map(u => u.name).join(', '));
  console.log('\n--- ASSIGNED SERVICES (' + assigned.length + ') ---');
  console.log(assigned);
}

run().catch(console.error);
