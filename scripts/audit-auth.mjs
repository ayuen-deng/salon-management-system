import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this audit.');
const client = createClient(supabaseUrl, serviceKey);

async function runAudit() {
  const { data: appUsers } = await client.from('app_user').select('id, full_name, display_name, phone, role, status');
  const { data: authData } = await client.auth.admin.listUsers();
  const authUsers = authData.users;

  console.log('=== APP USERS in public.app_user ===');
  console.table(appUsers);

  console.log('=== AUTH USERS in auth.users ===');
  console.table(authUsers.map(u => ({ id: u.id, email: u.email, confirmed: u.email_confirmed_at != null })));

  console.log('=== ID MATCH CHECK ===');
  for (const au of appUsers) {
    const match = authUsers.find(u => u.id === au.id);
    console.log(`${au.display_name} (${au.role}): ${match ? 'MATCHED with ' + match.email : 'NOT FOUND IN auth.users'}`);
  }

  console.log('\n=== CHECKING USERNAME "demo" ===');
  const demoEmail = 'demo@staff.kembabazi.salon';
  const testRes = await client.auth.signInWithPassword({ email: demoEmail, password: 'any' });
  console.log('Attempt login with demo@staff.kembabazi.salon:', testRes.error?.message);
}

runAudit();
