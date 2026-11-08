import { createClient } from '@supabase/supabase-js';

if (process.env.NODE_ENV === 'production') {
  console.error('Error: Refusing to run seed:auth in production environment.');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running seed-demo-auth.');

const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Demo accounts with 6-digit PINs (dev only)
export const DEMO_USERS = [
  { id: 'c0000000-0000-0000-0000-000000000001', email: 'owner@mzuri.salon', pin: '111111', role: 'owner', name: 'Godfrey Mugisha' },
  { id: 'c0000000-0000-0000-0000-000000000002', email: 'manager@mzuri.salon', pin: '222222', role: 'manager', name: 'Joan Tumusiime' },
  { id: 'c0000000-0000-0000-0000-000000000003', email: 'hr@mzuri.salon', pin: '333333', role: 'hr', name: 'David Kato' },
  { id: 'c0000000-0000-0000-0000-000000000004', email: 'mary@staff.mzuri.salon', pin: '444444', role: 'receptionist', name: 'Mary Namubiru' },
  { id: 'c0000000-0000-0000-0000-000000000005', email: 'grace@staff.mzuri.salon', pin: '555555', role: 'staff', name: 'Grace Atuhaire' },
  { id: 'c0000000-0000-0000-0000-000000000006', email: 'sarah@staff.mzuri.salon', pin: '555555', role: 'staff', name: 'Sarah Kobusingye' },
  { id: 'c0000000-0000-0000-0000-000000000007', email: 'peter@staff.mzuri.salon', pin: '555555', role: 'staff', name: 'Peter Byamukama' },
  { id: 'c0000000-0000-0000-0000-000000000008', email: 'rose@staff.mzuri.salon', pin: '555555', role: 'staff', name: 'Rose Kyomugisha' },
];

async function seedAuth() {
  console.log('Synchronizing demo auth accounts and 6-digit PINs...');
  for (const u of DEMO_USERS) {
    try {
      const { error } = await client.auth.admin.createUser({
        id: u.id,
        email: u.email,
        password: u.pin,
        email_confirm: true,
        user_metadata: { role: u.role, full_name: u.name },
      });

      if (error) {
        // If user already exists, update their email, password and metadata
        await client.auth.admin.updateUserById(u.id, {
          email: u.email,
          password: u.pin,
          email_confirm: true,
          user_metadata: { role: u.role, full_name: u.name },
        });
        console.log(`  Updated ${u.role}: ${u.email} -> PIN: ${u.pin}`);
      } else {
        console.log(`  Created ${u.role}: ${u.email} -> PIN: ${u.pin}`);
      }
    } catch (e) {
      console.error(`  Error processing ${u.email}:`, e);
    }
  }
  console.log('✅ Demo auth seeding completed successfully.');
}

seedAuth();
