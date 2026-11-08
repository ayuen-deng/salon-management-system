const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\e785eeb8-3e06-44ad-90aa-a088bcce5bd0';

async function testReceipts() {
  console.log('Testing receipt print routes with Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 800, height: 1200 },
  });
  const page = await context.newPage();

  // Test visit IDs representing different cases
  // First query recent visit from database
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

  const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/visit?select=id,ticket_code,status&limit=5', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
  });
  const visits = await r.json();
  const testVisitId = visits[0]?.id || 'a5cbe137-c08d-4bbe-be5b-e0ac086c1ed3';

  console.log(`Using sample visit ID: ${testVisitId}`);

  const testCases = [
    {
      name: 'receipt-normal',
      url: `http://localhost:3000/print/receipt/${testVisitId}?auto=false`,
      screenshot: 'mzuri_receipt_normal.png',
      pdf: 'mzuri_receipt_normal.pdf',
    },
    {
      name: 'receipt-duplicate',
      url: `http://localhost:3000/print/receipt/${testVisitId}?auto=false`,
      screenshot: 'mzuri_receipt_duplicate.png',
      pdf: 'mzuri_receipt_duplicate.pdf',
    },
  ];

  for (const tc of testCases) {
    console.log(`Navigating to ${tc.url}...`);
    await page.goto(tc.url, { waitUntil: 'networkidle' });

    const content = await page.content();

    // Assert zero app chrome
    const forbidden = [
      'Switch role',
      'Demo data environment',
      'Reception Dashboard',
      'Manager Dashboard',
      'Owner Dashboard',
      'Today in salon',
    ];

    for (const f of forbidden) {
      if (content.includes(f)) {
        throw new Error(`Forbidden app chrome "${f}" found in receipt!`);
      }
    }
    console.log(`  ✓ Zero app chrome confirmed for ${tc.name}`);

    // Assert required fields
    if (!content.includes('Mzuri Unisex Salon')) throw new Error('Missing salon name!');
    if (!content.includes('Mbarara')) throw new Error('Missing location!');
    if (!content.includes('Receipt No:')) throw new Error('Missing receipt number label!');
    if (!content.includes('TOTAL PAID:')) throw new Error('Missing total paid!');
    if (!content.includes('This is not a fiscal tax receipt.')) throw new Error('Missing tax disclaimer!');
    console.log(`  ✓ All required receipt fields present for ${tc.name}`);

    // Capture screenshot
    const shotPath = path.join(ARTIFACT_DIR, tc.screenshot);
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`  ✓ Screenshot saved: ${shotPath}`);

    // Generate PDF at 80mm roll width
    const pdfPath = path.join(ARTIFACT_DIR, tc.pdf);
    await page.pdf({
      path: pdfPath,
      width: '80mm',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    console.log(`  ✓ 80mm PDF saved: ${pdfPath}`);
  }

  await browser.close();
  console.log('Receipt print route verification completed successfully!');
}

testReceipts().catch((err) => {
  console.error('Receipt test failed:', err);
  process.exit(1);
});
