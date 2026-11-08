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

async function run() {
  const r = await fetch(url + '/rest/v1/service?select=id,name,category', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const services = await r.json();
  console.log(`Fetched ${services.length} services.`);

  // Update categories that need merging:
  // e.g. Nails & Spa, Nails & Beauty -> Nails
  let updatedCount = 0;
  for (const s of services) {
    let newCat = s.category;
    if (s.category.includes('Nails & Spa') || s.category.includes('Nails & Beauty')) {
      newCat = s.category.replace('Nails & Spa', 'Nails').replace('Nails & Beauty', 'Nails');
    }
    if (s.category === 'Hair Care') {
      newCat = 'both|Hair care and treatments|Care';
    }
    if (s.category === 'Braids & Weaves') {
      newCat = 'women|Braids and styling|Braids';
    }
    if (s.category === 'Barbering') {
      newCat = 'men|Haircuts|General';
    }

    if (newCat !== s.category) {
      await fetch(url + `/rest/v1/service?id=eq.${s.id}`, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ category: newCat })
      });
      console.log(`Updated "${s.name}": "${s.category}" -> "${newCat}"`);
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} services.`);
}

run();
