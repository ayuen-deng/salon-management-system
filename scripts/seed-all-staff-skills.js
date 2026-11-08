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

const STAFF_IDS = {
  PETER: 'c0000000-0000-0000-0000-000000000007', // Barber
  ROSE: 'c0000000-0000-0000-0000-000000000008',  // Wash & Care / Treatments
  GRACE: 'c0000000-0000-0000-0000-000000000005', // Styling & Braids
  SARAH: 'c0000000-0000-0000-0000-000000000006', // Styling & Braids & Beauty
};

async function run() {
  console.log('Seeding skills for all 35 services...');
  const { data: services } = await client.from('service').select('id, name');
  console.log(`Found ${services.length} services.`);

  const newSkills = [];

  for (const s of services) {
    const nameLower = s.name.toLowerCase();

    // Peter (Barber): Men's haircuts, beard, clean shaves, kids haircuts, fade
    if (
      nameLower.includes('beard') ||
      nameLower.includes('shave') ||
      nameLower.includes('fade') ||
      nameLower.includes('haircut') ||
      nameLower.includes('men')
    ) {
      newSkills.push({ service_id: s.id, staff_user_id: STAFF_IDS.PETER });
    }

    // Rose (Wash & Care): Washes, treatments, scalp, massages, relaxer, facial
    if (
      nameLower.includes('wash') ||
      nameLower.includes('shampoo') ||
      nameLower.includes('treatment') ||
      nameLower.includes('massage') ||
      nameLower.includes('relaxer') ||
      nameLower.includes('facial')
    ) {
      newSkills.push({ service_id: s.id, staff_user_id: STAFF_IDS.ROSE });
    }

    // Grace & Sarah: Styling, braids, colours, weaves, makeup, lashes, nails
    if (
      nameLower.includes('braid') ||
      nameLower.includes('cornrow') ||
      nameLower.includes('styling') ||
      nameLower.includes('blow-dry') ||
      nameLower.includes('wig') ||
      nameLower.includes('gele') ||
      nameLower.includes('makeup') ||
      nameLower.includes('lash') ||
      nameLower.includes('brow') ||
      nameLower.includes('manicure') ||
      nameLower.includes('pedicure') ||
      nameLower.includes('colour') ||
      nameLower.includes('color')
    ) {
      newSkills.push({ service_id: s.id, staff_user_id: STAFF_IDS.GRACE });
      newSkills.push({ service_id: s.id, staff_user_id: STAFF_IDS.SARAH });
    }
  }

  console.log(`Prepared ${newSkills.length} skill assignments. Upserting into staff_skill...`);
  const { data: inserted, error } = await client
    .from('staff_skill')
    .upsert(newSkills, { onConflict: 'staff_user_id,service_id' });

  if (error) {
    console.error('Error seeding skills:', error);
  } else {
    console.log('Successfully seeded skills for all services!');
  }

  // Verify that every service now has at least 1 staff assigned
  const { data: allSkills } = await client.from('staff_skill').select('service_id, staff_user_id');
  const serviceCountMap = {};
  for (const sk of allSkills || []) {
    serviceCountMap[sk.service_id] = (serviceCountMap[sk.service_id] || 0) + 1;
  }

  const unassigned = services.filter(srv => !serviceCountMap[srv.id]);
  console.log(`Unassigned services count: ${unassigned.length}`);
  if (unassigned.length > 0) {
    console.warn('Unassigned services remaining:', unassigned.map(u => u.name));
  } else {
    console.log('All 35 services have at least one skilled staff assigned!');
  }
}

run().catch(console.error);
