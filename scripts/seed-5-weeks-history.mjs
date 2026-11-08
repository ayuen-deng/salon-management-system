import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const envText = fs.readFileSync('.env.local', 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^\s*([^#=]+)=(.*)$/);
  if (match && !process.env[match[1].trim()]) {
    process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.');
}

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

const STAFF_LIST = [GRACE_ID, SARAH_ID, PETER_ID, ROSE_ID, RECEPTION_ID, MANAGER_ID];

async function seedHistory() {
  console.log('Seeding 5 weeks (35 days) of realistic historical business days and summaries...');

  // Get a valid customer ID
  const { data: custs } = await client.from('customer').select('id').limit(1);
  const custId = custs?.[0]?.id || null;

  const today = new Date();
  
  for (let daysAgo = 35; daysAgo >= 1; daysAgo--) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysAgo);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Check if business day already exists
    const { data: existingDay } = await client
      .from('business_day')
      .select('id')
      .eq('location_id', LOC_ID)
      .eq('business_date', dateStr)
      .maybeSingle();

    let dayId = existingDay?.id;

    if (!dayId) {
      const openedAt = new Date(targetDate);
      openedAt.setHours(8, Math.floor(Math.random() * 15), 0, 0);

      const closedAt = new Date(targetDate);
      closedAt.setHours(20, Math.floor(Math.random() * 30), 0, 0);

      const cashCounted = 150000 + Math.floor(Math.random() * 80000);

      const { data: newDay, error: dErr } = await client
        .from('business_day')
        .insert({
          organization_id: ORG_ID,
          location_id: LOC_ID,
          business_date: dateStr,
          status: 'closed',
          opened_at: openedAt.toISOString(),
          opened_by: MANAGER_ID,
          closed_at: closedAt.toISOString(),
          closed_by: MANAGER_ID,
          cash_float: 50000,
          cash_counted: cashCounted,
        })
        .select('id')
        .single();

      if (dErr) {
        console.error(`Error creating day for ${dateStr}:`, dErr.message);
        continue;
      }
      dayId = newDay.id;
    }

    // Insert attendance for this historical day (skip if exists)
    for (const sid of STAFF_LIST) {
      const { data: existingAtt } = await client
        .from('attendance')
        .select('id')
        .eq('staff_user_id', sid)
        .eq('business_date', dateStr)
        .maybeSingle();

      if (!existingAtt) {
        const isLate = Math.random() < 0.15;
        const clockIn = new Date(targetDate);
        clockIn.setHours(7, isLate ? 45 + Math.floor(Math.random() * 25) : 30 + Math.floor(Math.random() * 15), 0, 0);

        await client.from('attendance').insert({
          organization_id: ORG_ID,
          location_id: LOC_ID,
          staff_user_id: sid,
          business_date: dateStr,
          clock_in: clockIn.toISOString(),
          absence_type: 'none',
        });
      }
    }

    // Check if payments exist for this day
    const { count: paymentCount } = await client
      .from('payment')
      .select('id', { count: 'exact', head: true })
      .eq('business_day_id', dayId);

    if (!paymentCount || paymentCount === 0) {
      // Create a dummy visit and payment records
      if (custId) {
        const { data: histVisit } = await client.from('visit').insert({
          organization_id: ORG_ID,
          location_id: LOC_ID,
          business_day_id: dayId,
          customer_id: custId,
          ticket_code: `P${daysAgo}`,
          status: 'paid',
          total_list_ugx: 120000,
          total_discount_ugx: 0,
          total_final_ugx: 120000,
        }).select('id').maybeSingle();

        const vId = histVisit?.id || null;

        if (vId) {
          // Realistic daily revenue around UGX 1,400,000 to UGX 2,100,000
          const momoAmount = 1200000 + Math.floor(Math.random() * 600000);
          const cashAmount = 150000 + Math.floor(Math.random() * 100000);

          // MoMo payment (confirmed)
          await client.from('payment').insert({
            organization_id: ORG_ID,
            location_id: LOC_ID,
            business_day_id: dayId,
            visit_id: vId,
            method: 'mobile_money',
            amount_ugx: momoAmount,
            status: 'confirmed',
            provider_reference: `MTN-HIST-${dateStr.replace(/-/g, '')}`,
            recorded_by: MANAGER_ID,
            idempotency_key: `momo_${dateStr}_${daysAgo}`,
          });

          // Cash payment
          await client.from('payment').insert({
            organization_id: ORG_ID,
            location_id: LOC_ID,
            business_day_id: dayId,
            visit_id: vId,
            method: 'cash',
            amount_ugx: cashAmount,
            status: 'confirmed',
            recorded_by: MANAGER_ID,
            idempotency_key: `cash_${dateStr}_${daysAgo}`,
          });
        }
      }
    }

    // Generate daily summary record if missing
    const { data: existingSummary } = await client
      .from('daily_summary')
      .select('id')
      .eq('business_day_id', dayId)
      .maybeSingle();

    if (!existingSummary) {
      await client.from('daily_summary').insert({
        business_day_id: dayId,
        version: 1,
        data: {
          date: dateStr,
          customers_served: 28 + Math.floor(Math.random() * 10),
          left_queue: Math.floor(Math.random() * 3),
          no_shows: Math.floor(Math.random() * 2),
          momo_ugx: 1400000,
          cash_ugx: 180000,
          verified_pct: 100,
          paper_entered_count: Math.floor(Math.random() * 4),
          staff_present: 6,
          staff_expected: 6,
        },
      });
    }
  }

  // Also seed a few diverse audit_log entries for "For your review"
  console.log('Seeding diverse review items in audit_log...');
  const reviewSeeds = [
    { action: 'DISCOUNT_APPROVED', category: 'financial', reason: 'Discount UGX 10,000 for ticket A04 (Returning loyal client)', actor_role: 'manager' },
    { action: 'PAYMENT_REFUNDED', category: 'financial', reason: 'Refund UGX 20,000 for incomplete dye service on ticket A09', actor_role: 'manager' },
    { action: 'TICKET_VOIDED', category: 'reception', reason: 'Ticket A02 voided due to accidental duplicate entry', actor_role: 'receptionist' },
    { action: 'COMPLIMENTARY_SERVICE', category: 'catalogue', reason: 'Complimentary scalp treatment provided for 45-min dryer delay', actor_role: 'manager' },
    { action: 'WRITE_OFF_RECORDED', category: 'financial', reason: 'Write-off UGX 5,000 unreconciled Airtel MoMo difference', actor_role: 'manager' },
    { action: 'REOPEN_DAY', category: 'audit', reason: 'Reopened business day to register late evening cash settlement', actor_role: 'manager' },
    { action: 'EXPORT_CLIENT_PROFILE', category: 'people', reason: 'Exported client profile history PDF for Aisha', actor_role: 'manager' },
    { action: 'HR_ACCESS_UPDATED', category: 'access', reason: 'Assigned stylist skill credentials for Rose Kyomugisha', actor_role: 'hr' },
  ];

  for (const item of reviewSeeds) {
    await client.from('audit_log').insert({
      actor_id: item.actor_role === 'hr' ? 'c0000000-0000-0000-0000-000000000003' : MANAGER_ID,
      actor_role: item.actor_role,
      action: item.action,
      entity_type: 'business_event',
      entity_id: `seed_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      reason: item.reason,
      category: item.category,
      at: new Date(Date.now() - Math.floor(Math.random() * 86400000 * 3)).toISOString(),
    });
  }

  console.log('✅ Completed 5-week history and review seed.');
}

seedHistory();
