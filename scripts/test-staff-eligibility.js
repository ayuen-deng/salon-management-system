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
  // Find Peter, Rose, Sarah, Grace
  const { data: staff } = await client
    .from('app_user')
    .select('id, display_name, role')
    .eq('role', 'staff');
  console.log('Staff members:', staff);

  const beardTrimServiceId = '86ef3311-0204-495f-b0e4-1645869db5d0';

  for (const s of staff || []) {
    const { data: skills } = await client
      .from('staff_skill')
      .select('service_id, service(name)')
      .eq('staff_user_id', s.id);
    const skillIds = new Set((skills || []).map(x => x.service_id));
    const hasSkillSet = skillIds.size;
    const hasBeardTrim = skillIds.has(beardTrimServiceId);
    console.log(`Staff ${s.display_name} (${s.id}): total skills = ${hasSkillSet}, has Beard Trim = ${hasBeardTrim}`);
    console.log(`  Skills:`, skills?.map(x => x.service?.name));
    // Check eligibility with current code:
    // const hasSkill = isPool ? skillSet.size === 0 || skillSet.has(serviceId) : true;
    const isEligibleCurrent = hasSkillSet === 0 || hasBeardTrim;
    console.log(`  Current evaluation: skillSet.size (${hasSkillSet}) === 0 || hasBeardTrim (${hasBeardTrim}) => ${isEligibleCurrent}\n`);
  }
}

run().catch(console.error);
