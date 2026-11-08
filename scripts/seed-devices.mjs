import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
});

const client = createClient(url, key);

async function seedDevices() {
  const { data: bday } = await client.from('business_day').select('*').limit(1).single();
  const { data: mgr } = await client.from('app_user').select('id').eq('role', 'manager').single();

  const devices = [
    {
      organization_id: bday.organization_id,
      location_id: bday.location_id,
      kind: 'reception_tablet',
      name: 'Reception Desk Tablet (Galaxy Tab A)',
      pairing_code: '883921',
      device_token: 'TOK-TAB-01',
      paired_by: mgr.id
    },
    {
      organization_id: bday.organization_id,
      location_id: bday.location_id,
      kind: 'queue_screen',
      name: 'Lounge Queue TV Display 55-inch',
      pairing_code: '441902',
      device_token: 'TOK-TV-01',
      paired_by: mgr.id
    }
  ];

  const { data, error } = await client.from('device').insert(devices).select();
  console.log('Seeded devices count:', data?.length, 'error:', error);
}

seedDevices().catch(console.error);
