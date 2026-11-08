import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running owner-account.');

const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const action = process.argv[2] || 'rotate';
const OWNER_ID = 'c0000000-0000-0000-0000-000000000001';

async function manageOwnerAccount() {
  if (action === 'disable') {
    console.log('Disabling dedicated owner demo account...');
    await client.auth.admin.updateUserById(OWNER_ID, {
      ban_duration: '876000h', // 100 years
    });
    await client.from('app_user').update({ status: 'inactive' }).eq('id', OWNER_ID);
    console.log('✅ Owner demo account deactivated and banned from sign in.');
  } else if (action === 'enable') {
    console.log('Re-enabling owner account...');
    await client.auth.admin.updateUserById(OWNER_ID, {
      ban_duration: 'none',
      password: '111111',
    });
    await client.from('app_user').update({ status: 'active' }).eq('id', OWNER_ID);
    console.log('✅ Owner demo account active with PIN 111111.');
  } else {
    // Generate new random 6-digit PIN
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`Rotating PIN for dedicated owner demo account...`);
    await client.auth.admin.updateUserById(OWNER_ID, {
      password: newPin,
      ban_duration: 'none',
    });
    await client.from('app_user').update({ status: 'active' }).eq('id', OWNER_ID);
    console.log(`✅ Dedicated Owner PIN updated to: ${newPin}`);
    console.log(`   Username: owner`);
  }
}

manageOwnerAccount();
