import { createClient } from '@supabase/supabase-js';

if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
  console.error('Safety Guard: Cannot run demo scenario script in production environment!');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running demo-scenario.');

const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const LOC_ID = 'b0000000-0000-0000-0000-000000000001';
const MANAGER_ID = 'c0000000-0000-0000-0000-000000000002';
const RECEPTION_ID = 'c0000000-0000-0000-0000-000000000004';
const GRACE_ID = 'c0000000-0000-0000-0000-000000000005';
const SARAH_ID = 'c0000000-0000-0000-0000-000000000006';
const PETER_ID = 'c0000000-0000-0000-0000-000000000007';
const ROSE_ID = 'c0000000-0000-0000-0000-000000000008';

const scenarioName = process.argv[2] || 'morning';

async function resetDemoData() {
  console.log('Clearing existing demo transaction data...');
  await client.from('reconciliation_entry').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('statement_import').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('approval_request').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('payment').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('visit_service').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('visit').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('appointment').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('business_day_snapshot').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('ticket_counter').delete().neq('business_day_id', '00000000-0000-0000-0000-000000000000');
  await client.from('business_day').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await client.from('customer').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('✅ Reset complete.');
}

async function runScenario() {
  await resetDemoData();
  const today = new Date().toISOString().split('T')[0];

  // 1. Get or Create Business Day (Open)
  let { data: day } = await client
    .from('business_day')
    .select('*')
    .eq('business_date', today)
    .maybeSingle();

  if (!day) {
    const { data: newDay, error: dayErr } = await client.from('business_day').insert({
      organization_id: ORG_ID,
      location_id: LOC_ID,
      business_date: today,
      status: 'open',
      opened_at: new Date().toISOString(),
      opened_by: MANAGER_ID,
      cash_float: 50000,
    }).select().single();
    if (dayErr) console.error('Business day insert error:', dayErr);
    day = newDay;
  } else if (day.status !== 'open') {
    const { data: updatedDay } = await client
      .from('business_day')
      .update({ status: 'open', closed_at: null, closed_by: null })
      .eq('id', day.id)
      .select()
      .single();
    day = updatedDay;
  }

  // 2. Staff Attendance: Grace and Sarah clocked in, Peter on break, Rose clocked out
  await client.from('attendance').insert([
    {
      organization_id: ORG_ID,
      location_id: LOC_ID,
      staff_user_id: GRACE_ID,
      business_date: today,
      clock_in: new Date(Date.now() - 3600000 * 4).toISOString(),
      on_break: false,
      absence_type: 'none',
    },
    {
      organization_id: ORG_ID,
      location_id: LOC_ID,
      staff_user_id: SARAH_ID,
      business_date: today,
      clock_in: new Date(Date.now() - 3600000 * 3).toISOString(),
      on_break: false,
      absence_type: 'none',
    },
    {
      organization_id: ORG_ID,
      location_id: LOC_ID,
      staff_user_id: PETER_ID,
      business_date: today,
      clock_in: new Date(Date.now() - 3600000 * 2).toISOString(),
      on_break: true,
      absence_type: 'none',
    },
    {
      organization_id: ORG_ID,
      location_id: LOC_ID,
      staff_user_id: RECEPTION_ID,
      business_date: today,
      clock_in: new Date(Date.now() - 3600000 * 5).toISOString(),
      on_break: false,
      absence_type: 'none',
    },
    {
      organization_id: ORG_ID,
      location_id: LOC_ID,
      staff_user_id: MANAGER_ID,
      business_date: today,
      clock_in: new Date(Date.now() - 3600000 * 6).toISOString(),
      on_break: false,
      absence_type: 'none',
    },
  ]);
  // Rose Kyomugisha has no clock_in row for today (status = out)

  // 3. Fake Customer Profiles (Ugandan fictional names)
  const { data: custAisha } = await client.from('customer').insert({
    organization_id: ORG_ID,
    location_id: LOC_ID,
    phone_e164: '+256772990001',
    first_name: 'Aisha',
  }).select().single();

  const { data: custFaith } = await client.from('customer').insert({
    organization_id: ORG_ID,
    location_id: LOC_ID,
    phone_e164: '+256772990002',
    first_name: 'Faith',
  }).select().single();

  const { data: custRonald } = await client.from('customer').insert({
    organization_id: ORG_ID,
    location_id: LOC_ID,
    phone_e164: '+256772990004',
    first_name: 'Ronald',
  }).select().single();

  if (scenarioName === 'morning') {
    console.log('\n=============================================');
    console.log('SCENARIO: MORNING (Fresh Salon Opening)');
    console.log('=============================================');
    console.log('Status: Day open since 08:00 AM, 6 staff present, 0 queue tickets.');
    console.log('Ready to run the Aisha story live from the Reception desk (/reception)!');
    return;
  }

  if (scenarioName === 'busy-afternoon' || scenarioName === 'end-of-day') {
    // Variants lookup
    const { data: variants } = await client.from('service_variant').select('id, name, list_price_ugx');
    const washVar = variants.find(v => v.name.includes('Wash')) || variants[0];
    const blowVar = variants.find(v => v.name.includes('Blow-dry')) || variants[1];
    const braidVar = variants.find(v => v.name.includes('Braids')) || variants[2];

    // Visit 1: Aisha (In Service, wash completed, waiting between services)
    const { data: v1 } = await client.from('visit').insert({
      organization_id: ORG_ID,
      location_id: LOC_ID,
      business_day_id: day.id,
      customer_id: custAisha.id,
      status: 'in_service',
      ticket_code: 'A17',
      total_list_ugx: 100000,
      total_discount_ugx: 5000,
      total_final_ugx: 95000,
      queued_at: new Date(Date.now() - 3600000).toISOString(),
    }).select().single();

    // Line 1: Wash (Done)
    await client.from('visit_service').insert({
      visit_id: v1.id,
      service_variant_id: washVar.id,
      staff_user_id: ROSE_ID,
      sequence_no: 1,
      status: 'done',
      list_price_ugx: 50000,
      discount_ugx: 0,
      final_price_ugx: 50000,
      started_at: new Date(Date.now() - 3600000).toISOString(),
      ended_at: new Date(Date.now() - 1800000).toISOString(),
    });

    // Line 2: Blowdry (Ready, waiting for Grace > 10m -> yellow flag!)
    await client.from('visit_service').insert({
      visit_id: v1.id,
      service_variant_id: blowVar.id,
      staff_user_id: GRACE_ID,
      sequence_no: 2,
      status: 'ready',
      ready_at: new Date(Date.now() - 1800000).toISOString(), // 30m ago!
      list_price_ugx: 50000,
      discount_ugx: 5000,
      final_price_ugx: 45000,
    });

    // Visit 2: Faith (In Service with Sarah, braid line in progress)
    const { data: v2 } = await client.from('visit').insert({
      organization_id: ORG_ID,
      location_id: LOC_ID,
      business_day_id: day.id,
      customer_id: custFaith.id,
      status: 'in_service',
      ticket_code: 'A18',
      total_list_ugx: 120000,
      total_discount_ugx: 0,
      total_final_ugx: 120000,
      queued_at: new Date(Date.now() - 900000).toISOString(),
    }).select().single();

    // Line for Sarah (in progress)
    await client.from('visit_service').insert({
      visit_id: v2.id,
      service_variant_id: braidVar.id,
      staff_user_id: SARAH_ID,
      sequence_no: 1,
      status: 'in_progress',
      list_price_ugx: 120000,
      discount_ugx: 0,
      final_price_ugx: 120000,
      started_at: new Date(Date.now() - 600000).toISOString(),
    });

    // Visit 3: Ronald (Pool item ready for haircut, sequence 1, plus wash blocked)
    const { data: v3 } = await client.from('visit').insert({
      organization_id: ORG_ID,
      location_id: LOC_ID,
      business_day_id: day.id,
      customer_id: custRonald.id,
      status: 'queued',
      ticket_code: 'A19',
      total_list_ugx: 40000,
      total_discount_ugx: 0,
      total_final_ugx: 40000,
      queued_at: new Date(Date.now() - 300000).toISOString(),
    }).select().single();

    // Pool Line (Ready, unassigned, Peter or any skilled barber can take)
    await client.from('visit_service').insert({
      visit_id: v3.id,
      service_variant_id: variants[0].id,
      staff_user_id: null,
      sequence_no: 1,
      status: 'ready',
      ready_at: new Date(Date.now() - 300000).toISOString(),
      list_price_ugx: 20000,
      discount_ugx: 0,
      final_price_ugx: 20000,
    });

    // Blocked Line for Rose (Wash step 2 waiting for haircut step 1)
    await client.from('visit_service').insert({
      visit_id: v3.id,
      service_variant_id: washVar.id,
      staff_user_id: ROSE_ID,
      sequence_no: 2,
      status: 'blocked',
      list_price_ugx: 20000,
      discount_ugx: 0,
      final_price_ugx: 20000,
    });

    // Pending discount approval for Ronald
    await client.from('approval_request').insert({
      organization_id: ORG_ID,
      location_id: LOC_ID,
      kind: 'discount',
      payload: { ticket_code: 'A14', amount_ugx: 8000, reason: 'price dispute' },
      requested_by: RECEPTION_ID,
      status: 'pending',
    });

    if (scenarioName === 'end-of-day') {
      // Completed payments for end-of-day reconciliation
      await client.from('payment').insert({
        organization_id: ORG_ID,
        location_id: LOC_ID,
        visit_id: v1.id,
        business_day_id: day.id,
        method: 'mobile_money',
        amount_ugx: 95000,
        status: 'confirmed',
        confirmation_level: 'attested',
        provider_reference: 'MM-REC-001',
        idempotency_key: 'PAY-DEMO-001',
        recorded_by: RECEPTION_ID,
      });

      await client.from('payment').insert({
        organization_id: ORG_ID,
        location_id: LOC_ID,
        visit_id: v1.id,
        business_day_id: day.id,
        method: 'cash',
        amount_ugx: 170000,
        status: 'confirmed',
        confirmation_level: 'confirmed_via_provider',
        idempotency_key: 'PAY-DEMO-CASH',
        recorded_by: RECEPTION_ID,
      });
    }

    console.log(`\n=============================================`);
    console.log(`SCENARIO APPLIED: ${scenarioName.toUpperCase()}`);
    console.log(`=============================================`);
    console.log(`• Active Business Day ID: ${day.id}`);
    console.log(`• Ticket A17 (Aisha): Wash done, waiting between services for Grace (flagged)`);
    console.log(`• Ticket A18 (Faith): Queued in waiting lounge`);
    console.log(`• Pending Approval: UGX 8,000 discount request in Manager Inbox`);
    if (scenarioName === 'end-of-day') {
      console.log(`• Recorded Payments: MoMo UGX 95,000 (MM-REC-001), Cash UGX 170,000`);
      console.log(`• MoMo Statement CSV available in demo/momo-statement.csv`);
    }
  }
}

if (scenarioName === 'reset') {
  resetDemoData();
} else {
  runScenario();
}
