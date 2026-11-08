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

async function init() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const locationId = 'b0000000-0000-0000-0000-000000000001';
  const defaults = [
    { key: 'auto_print_receipt', value: true },
    { key: 'receipt_address', value: '', placeholders: ['High Street, Mbarara, Uganda'] },
    { key: 'receipt_phone', value: '', placeholders: ['+256 772 123 456'] },
    { key: 'receipt_footer', value: '', placeholders: ['Thank you for visiting Mzuri Unisex Salon!'] },
    { key: 'receipt_fiscal_disclaimer_enabled', value: true }
  ];
  for (const d of defaults) {
    const checkRes = await fetch(url + `/rest/v1/app_setting?select=id,value&location_id=eq.${locationId}&key=eq.${d.key}`, {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    const rows = await checkRes.json();
    if (rows && rows.length > 0) {
      const currentValue = rows[0].value;
      if (!d.placeholders?.includes(currentValue)) continue;
      const upRes = await fetch(url + `/rest/v1/app_setting?id=eq.${rows[0].id}`, {
        method: 'PATCH',
        headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: d.value })
      });
      console.log('Updated', d.key, upRes.status);
    } else {
      const insRes = await fetch(url + '/rest/v1/app_setting', {
        method: 'POST',
        headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          key: d.key,
          value: d.value
        })
      });
      console.log('Inserted', d.key, insRes.status);
    }
  }
}
init().catch(console.error);
