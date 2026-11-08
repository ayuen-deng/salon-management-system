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

async function check() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Querying business_day table...');
  const bdayRes = await fetch(url + '/rest/v1/business_day?select=*&order=business_date.desc&limit=10', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const bdays = await bdayRes.json();
  console.log('Recent business days:');
  console.table(bdays.map(b => ({ id: b.id, date: b.business_date, status: b.status, opened_at: b.opened_at, closed_at: b.closed_at })));

  console.log('\nQuerying open / queued / in_service visits...');
  const visitRes = await fetch(url + '/rest/v1/visit?select=id,ticket_code,status,business_day_id,queued_at,created_at&status=in.(queued,in_service)&order=created_at.desc', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const visits = await visitRes.json();
  console.log(`Open visits count: ${visits.length}`);
  console.table(visits.map(v => ({ id: v.id, ticket: v.ticket_code, status: v.status, day_id: v.business_day_id, queued_at: v.queued_at })));
}

check().catch(console.error);
