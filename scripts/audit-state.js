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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

async function check() {
  const rVisits = await fetch(`${url}/rest/v1/visit?select=id,ticket_code,status,payment_status&limit=10`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const visits = await rVisits.json();
  console.log('Visits sample:', visits);

  const rDevices = await fetch(`${url}/rest/v1/device_pairing?select=*`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const devices = await rDevices.json();
  console.log('Devices:', devices);

  const rServices = await fetch(`${url}/rest/v1/service?select=id,name,category,image_url`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const services = await rServices.json();
  console.log('Total services:', services?.length);
  console.log('Services with direct image_url:', services.filter(s => s.image_url)?.length);
  console.log('Distinct categories in service table:', [...new Set(services.map(s => s.category))]);

  const rMeta = await fetch(`${url}/rest/v1/app_setting?key=eq.service_metadata`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const meta = await rMeta.json();
  console.log('service_metadata in app_setting:', meta?.[0]?.value ? Object.keys(meta[0].value).length : 'none');
  if (meta?.[0]?.value) {
    const firstKey = Object.keys(meta[0].value)[0];
    console.log('Sample service_metadata entry:', meta[0].value[firstKey]);
  }

  const rBday = await fetch(`${url}/rest/v1/business_day?select=*&limit=5`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const bdays = await rBday.json();
  console.log('Business days:', bdays);
}

check().catch(console.error);
