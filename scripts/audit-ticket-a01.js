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
  console.log('--- AUDITING TICKET A01 AND AYUEN ---');
  const { data: visits } = await client
    .from('visit')
    .select(`
      id, ticket_code, status, queued_at, customer_id, business_day_id,
      customer ( id, first_name, phone_e164 ),
      visit_service (
        id, sequence_no, status, assignment_mode, staff_user_id, service_variant_id,
        service_variant ( id, name, service_id, service ( id, name ) )
      )
    `)
    .eq('ticket_code', 'A01')
    .order('queued_at', { ascending: false })
    .limit(5);

  console.log('Visits with ticket A01:', JSON.stringify(visits, null, 2));

  console.log('\n--- AUDITING ALL VISIT SERVICES FOR AYUEN ---');
  const { data: custAyuen } = await client
    .from('customer')
    .select('id, first_name, phone_e164')
    .ilike('first_name', '%ayuen%');
  console.log('Customer matching ayuen:', custAyuen);

  if (custAyuen && custAyuen.length > 0) {
    const custId = custAyuen[0].id;
    const { data: ayuenVisits } = await client
      .from('visit')
      .select(`
        id, ticket_code, status, queued_at, business_day_id,
        visit_service (
          id, sequence_no, status, assignment_mode, staff_user_id, service_variant_id,
          service_variant ( id, name, service_id, service ( id, name ) )
        )
      `)
      .eq('customer_id', custId)
      .order('queued_at', { ascending: false });
    console.log('Ayuen visits:', JSON.stringify(ayuenVisits, null, 2));
  }
}

run().catch(console.error);
