import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach((line) => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
});

const client = createClient(url, key);

const ORG_ID = 'a0000000-0000-0000-0000-000000000001';
const LOC_ID = 'b0000000-0000-0000-0000-000000000001';
const MANAGER_ID = 'c0000000-0000-0000-0000-000000000002';
const HR_ID = 'c0000000-0000-0000-0000-000000000003';
const RECEPTION_ID = 'c0000000-0000-0000-0000-000000000004';
const GRACE_ID = 'c0000000-0000-0000-0000-000000000005';
const SARAH_ID = 'c0000000-0000-0000-0000-000000000006';
const PETER_ID = 'c0000000-0000-0000-0000-000000000007';
const ROSE_ID = 'c0000000-0000-0000-0000-000000000008';

const ALL_ROLES_USERS = [
  { id: MANAGER_ID, role: 'manager', name: 'Joan Tumusiime' },
  { id: HR_ID, role: 'hr', name: 'David Kato' },
  { id: RECEPTION_ID, role: 'receptionist', name: 'Mary Namubiru' },
  { id: GRACE_ID, role: 'staff', name: 'Grace Atuhaire' },
  { id: SARAH_ID, role: 'staff', name: 'Sarah Kobusingye' },
  { id: PETER_ID, role: 'staff', name: 'Peter Byamukama' },
  { id: ROSE_ID, role: 'staff', name: 'Rose Kyomugisha' },
];

async function seedHrPhase2Batch() {
  console.log('Seeding HR Phase 2 data with bulk inserts...');

  const today = new Date();

  // 1. Weekly Rota for all roles
  console.log('1. Upserting weekly rota entries for all roles...');
  const rotaEntries = [];
  for (const u of ALL_ROLES_USERS) {
    for (let dow = 1; dow <= 6; dow++) {
      rotaEntries.push({
        organization_id: ORG_ID,
        location_id: LOC_ID,
        staff_user_id: u.id,
        weekday: dow,
        start_time: '08:00:00',
        end_time: '18:00:00',
        effective_from: '2026-09-01',
      });
    }
  }
  // Delete and insert cleanly
  for (const u of ALL_ROLES_USERS) {
    await client.from('rota_entry').delete().eq('staff_user_id', u.id);
  }
  const { error: rErr } = await client.from('rota_entry').insert(rotaEntries);
  if (rErr) console.error('Rota insert error:', rErr.message);
  else console.log(`  Inserted ${rotaEntries.length} rota entries.`);

  // 2. 5 Weeks of Attendance across all roles
  console.log('2. Bulk inserting 5 weeks of realistic attendance records across all roles...');
  const attRows = [];

  for (let daysAgo = 35; daysAgo >= 0; daysAgo--) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - daysAgo);
    const dateStr = targetDate.toISOString().split('T')[0];
    const dow = targetDate.getDay();

    if (dow === 0) continue; // Sunday off

    for (const u of ALL_ROLES_USERS) {
      const roll = (daysAgo * 7 + u.id.charCodeAt(35)) % 100;
      if (roll < 5) {
        // Unapproved absence
        attRows.push({
          organization_id: ORG_ID,
          location_id: LOC_ID,
          staff_user_id: u.id,
          business_date: dateStr,
          absence_type: 'unapproved_absence',
        });
      } else if (roll < 10) {
        // Approved leave
        attRows.push({
          organization_id: ORG_ID,
          location_id: LOC_ID,
          staff_user_id: u.id,
          business_date: dateStr,
          absence_type: 'approved_leave',
        });
      } else {
        // Present
        const isLate = roll < 25; // 15% late
        const clockIn = new Date(targetDate);
        if (isLate) {
          clockIn.setHours(8, 20, 0, 0);
        } else {
          clockIn.setHours(7, 50, 0, 0);
        }

        const clockOut = new Date(targetDate);
        clockOut.setHours(18, 5, 0, 0);

        attRows.push({
          organization_id: ORG_ID,
          location_id: LOC_ID,
          staff_user_id: u.id,
          business_date: dateStr,
          clock_in: clockIn.toISOString(),
          clock_out: daysAgo === 0 ? null : clockOut.toISOString(),
          absence_type: 'none',
        });
      }
    }
  }

  // Delete existing records for these dates to prevent duplicates
  for (const u of ALL_ROLES_USERS) {
    await client.from('attendance').delete().eq('staff_user_id', u.id);
  }

  // Insert in batches of 100
  for (let i = 0; i < attRows.length; i += 100) {
    const batch = attRows.slice(i, i + 100);
    const { error: aErr } = await client.from('attendance').insert(batch);
    if (aErr) console.error('Attendance batch insert error:', aErr.message);
  }
  console.log(`  Inserted ${attRows.length} attendance rows.`);

  // 3. Leave records (past, upcoming, pending)
  console.log('3. Seeding leave records...');
  await client.from('leave_request').delete().eq('location_id', LOC_ID);

  const pastLeaveDate = new Date(today);
  pastLeaveDate.setDate(today.getDate() - 14);
  const pastLeaveStr = pastLeaveDate.toISOString().split('T')[0];

  const upcomingLeaveDate = new Date(today);
  upcomingLeaveDate.setDate(today.getDate() + 5);
  const upcomingLeaveStr = upcomingLeaveDate.toISOString().split('T')[0];

  const upcomingLeaveEnd = new Date(today);
  upcomingLeaveEnd.setDate(today.getDate() + 9);
  const upcomingLeaveEndStr = upcomingLeaveEnd.toISOString().split('T')[0];

  await client.from('leave_request').insert([
    {
      organization_id: ORG_ID,
      location_id: LOC_ID,
      staff_user_id: PETER_ID,
      from_date: pastLeaveStr,
      to_date: pastLeaveStr,
      leave_type: 'approved_leave',
      status: 'approved',
      requested_by: HR_ID,
      decided_by: HR_ID,
      decided_at: new Date(pastLeaveDate).toISOString(),
    },
    {
      organization_id: ORG_ID,
      location_id: LOC_ID,
      staff_user_id: ROSE_ID,
      from_date: upcomingLeaveStr,
      to_date: upcomingLeaveEndStr,
      leave_type: 'approved_leave',
      status: 'approved',
      requested_by: HR_ID,
      decided_by: HR_ID,
      decided_at: new Date().toISOString(),
    },
    {
      organization_id: ORG_ID,
      location_id: LOC_ID,
      staff_user_id: SARAH_ID,
      from_date: upcomingLeaveStr,
      to_date: upcomingLeaveStr,
      leave_type: 'approved_leave',
      status: 'requested',
      requested_by: MANAGER_ID,
    },
  ]);

  // 4. Inactive person & Manager revocation awaiting HR confirmation
  console.log('4. Seeding inactive test staff and manager revocation awaiting HR review...');
  const INACTIVE_STAFF_ID = 'c0000000-0000-0000-0000-000000000009';
  const { data: existingInactive } = await client.from('app_user').select('id').eq('id', INACTIVE_STAFF_ID).maybeSingle();

  if (!existingInactive) {
    await client.from('app_user').insert({
      id: INACTIVE_STAFF_ID,
      organization_id: ORG_ID,
      location_id: LOC_ID,
      role: 'staff',
      full_name: 'Ivan Mukasa',
      display_name: 'Ivan',
      phone: '+256772999888',
      username: 'ivan',
      status: 'inactive',
      start_date: '2026-01-15',
    });
  }

  // Clear previous revocations on Ivan to ensure fresh pending state
  await client.from('audit_log').delete().eq('entity_id', INACTIVE_STAFF_ID);

  await client.from('audit_log').insert({
    organization_id: ORG_ID,
    location_id: LOC_ID,
    actor_id: MANAGER_ID,
    actor_role: 'manager',
    action: 'MANAGER_REVOKE_STAFF',
    entity_type: 'app_user',
    entity_id: INACTIVE_STAFF_ID,
    category: 'access',
    reason: 'Misconduct reported at cash desk, manager immediate revocation',
    after: { revoked_by: 'Joan Tumusiime', status: 'inactive' },
  });

  // 5. Seed initial people & access audit logs
  console.log('5. Populating audit ledger entries...');
  await client.from('audit_log').insert([
    {
      organization_id: ORG_ID,
      location_id: LOC_ID,
      actor_id: HR_ID,
      actor_role: 'hr',
      action: 'ATTENDANCE_CORRECTED',
      entity_type: 'attendance',
      entity_id: GRACE_ID,
      category: 'people',
      reason: '[HR Review] Adjusted clock-out time due to biometric tablet sync delay',
      before: { clock_out: null },
      after: { clock_out: `${today.toISOString().split('T')[0]}T18:15:00Z` },
    },
    {
      organization_id: ORG_ID,
      location_id: LOC_ID,
      actor_id: HR_ID,
      actor_role: 'hr',
      action: 'RESET_PIN',
      entity_type: 'app_user',
      entity_id: PETER_ID,
      category: 'access',
      reason: 'Stylist forgot PIN after returning from leave',
      after: { pin_reset: true },
    },
  ]);

  console.log('✅ HR Phase 2 batch seed completed in seconds.');
}

seedHrPhase2Batch().catch(console.error);
