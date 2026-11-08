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
  const rVisits = await fetch(`${url}/rest/v1/visit?select=*&limit=2`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const visits = await rVisits.json();
  console.log('Visit table columns:', visits?.[0] ? Object.keys(visits[0]) : visits);

  const rServices = await fetch(`${url}/rest/v1/service?select=*&limit=5`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const services = await rServices.json();
  console.log('Service table columns:', services?.[0] ? Object.keys(services[0]) : services);
  console.log('Sample service:', services?.[0]);

  const rMeta = await fetch(`${url}/rest/v1/app_setting?key=eq.service_metadata`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const meta = await rMeta.json();
  console.log('Meta rows:', meta);

  const rBday = await fetch(`${url}/rest/v1/business_day?select=*&limit=2`, {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const bdays = await rBday.json();
  console.log('Bdays:', bdays);

  const rDeskCatalogue = await fetch('http://localhost:3000/desk');
  console.log('Desk page HTTP status:', rDeskCatalogue.status);
}

check().catch(console.error);
