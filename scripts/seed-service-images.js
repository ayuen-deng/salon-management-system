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

// Canonical categories with icons and sort order
const canonicalCategories = [
  { name: 'Haircuts', icon: 'Scissors', sort_order: 1 },
  { name: 'Hair care and treatments', icon: 'Sparkles', sort_order: 2 },
  { name: 'Colour', icon: 'Palette', sort_order: 3 },
  { name: 'Braids and styling', icon: 'Crown', sort_order: 4 },
  { name: 'Massage', icon: 'Heart', sort_order: 5 },
  { name: 'Makeup', icon: 'Smile', sort_order: 6 },
  { name: 'Nails', icon: 'Hand', sort_order: 7 },
  { name: 'Skin and facials', icon: 'Sun', sort_order: 8 },
  { name: 'Brows and lashes', icon: 'Eye', sort_order: 9 },
];

async function run() {
  const r = await fetch(url + '/rest/v1/service?select=id,name,category', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const services = await r.json();

  const metadata = {};
  for (const s of services) {
    let img = null;
    let featured = false;
    let sort_order = 10;
    const catLower = (s.category || '').toLowerCase();
    const nameLower = (s.name || '').toLowerCase();

    if (catLower.includes('haircut') || nameLower.includes('haircut') || nameLower.includes('fade')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/haircuts.jpg`;
      featured = true;
      sort_order = 1;
    } else if (catLower.includes('braid') || nameLower.includes('braid') || nameLower.includes('cornrow')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/braids.jpg`;
      featured = true;
      sort_order = 2;
    } else if (catLower.includes('massage') || nameLower.includes('massage')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/massage.jpg`;
      sort_order = 5;
    } else if (catLower.includes('nail') || nameLower.includes('manicure') || nameLower.includes('pedicure')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/nails.jpg`;
      featured = true;
      sort_order = 4;
    } else if (catLower.includes('makeup') || nameLower.includes('makeup')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/makeup.jpg`;
      sort_order = 6;
    } else if (catLower.includes('skin') || catLower.includes('facial') || nameLower.includes('facial')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/skincare.jpg`;
      sort_order = 7;
    } else if (catLower.includes('treatment') || catLower.includes('hair care') || nameLower.includes('wash') || nameLower.includes('shampoo')) {
      img = `${url}/storage/v1/object/public/catalogue-images/demo/treatments.jpg`;
      sort_order = 3;
    }

    metadata[s.id] = {
      image_url: img,
      featured,
      sort_order
    };
  }

  // Save canonical categories to app_setting 'canonical_categories'
  const catRes = await fetch(url + '/rest/v1/app_setting?key=eq.canonical_categories', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const catExists = await catRes.json();
  if (catExists && catExists.length > 0) {
    await fetch(url + '/rest/v1/app_setting?key=eq.canonical_categories', {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ value: canonicalCategories })
    });
  } else {
    await fetch(url + '/rest/v1/app_setting', {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ key: 'canonical_categories', value: canonicalCategories })
    });
  }
  console.log('Saved canonical categories setting.');

  // Save service metadata to app_setting 'service_metadata'
  const metaRes = await fetch(url + '/rest/v1/app_setting?key=eq.service_metadata', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const metaExists = await metaRes.json();
  if (metaExists && metaExists.length > 0) {
    await fetch(url + '/rest/v1/app_setting?key=eq.service_metadata', {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ value: metadata })
    });
  } else {
    await fetch(url + '/rest/v1/app_setting', {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ key: 'service_metadata', value: metadata })
    });
  }
  console.log(`Saved metadata for ${Object.keys(metadata).length} services.`);
}

run();
