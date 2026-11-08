import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
});

const client = createClient(url, key);

async function run() {
  const { data: bday } = await client.from('business_day').select('*').eq('status', 'open').maybeSingle();
  const { data: cust } = await client.from('customer').select('id, first_name').limit(2);
  const { data: stylist } = await client.from('app_user').select('id, display_name').eq('role', 'staff').limit(2);
  const { data: services } = await client.from('service').select('id, name, default_minutes').limit(2);

  if (!bday || !cust || !services) {
    console.log('Missing dependencies for appointment seeding');
    return;
  }

  const todayStr = '2026-10-04'; // Matching business day date
  const appts = [
    {
      organization_id: bday.organization_id,
      location_id: bday.location_id,
      customer_id: cust[0].id,
      staff_user_id: stylist?.[0]?.id || null,
      service_id: services[0].id,
      starts_at: `${todayStr}T14:00:00Z`,
      expected_minutes: services[0].default_minutes || 45,
      status: 'booked',
      late: false
    },
    {
      organization_id: bday.organization_id,
      location_id: bday.location_id,
      customer_id: cust[1]?.id || cust[0].id,
      staff_user_id: stylist?.[1]?.id || null,
      service_id: services[1]?.id || services[0].id,
      starts_at: `${todayStr}T16:30:00Z`,
      expected_minutes: 60,
      status: 'booked',
      late: false
    }
  ];

  const { data: inserted, error } = await client.from('appointment').insert(appts).select();
  console.log('Seeded appointments count:', inserted?.length, 'error:', error);

  // Seed discount reasons if empty
  const { data: dReasons } = await client.from('discount_reason').select('id');
  if (!dReasons || dReasons.length === 0) {
    await client.from('discount_reason').insert([
      { organization_id: bday.organization_id, location_id: bday.location_id, code: 'STUDENT', label: 'Student Discount (10%)', active: true },
      { organization_id: bday.organization_id, location_id: bday.location_id, code: 'LOYALTY', label: 'Loyalty Regular Customer', active: true },
      { organization_id: bday.organization_id, location_id: bday.location_id, code: 'SERVICE_RECOVERY', label: 'Service Recovery / Dispute', active: true },
      { organization_id: bday.organization_id, location_id: bday.location_id, code: 'PROMOTIONAL', label: 'Special Promotion', active: true },
    ]);
    console.log('Seeded discount reasons');
  }
}

run().catch(console.error);
