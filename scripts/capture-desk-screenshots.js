const { chromium } = require('playwright');
const path = require('path');

async function captureDesk() {
  const browser = await chromium.launch({ headless: true });
  const brainDir = path.join('C:', 'Users', 'PC', '.gemini', 'antigravity', 'brain', 'e785eeb8-3e06-44ad-90aa-a088bcce5bd0');

  // 1. Tablet Viewport (1024x768) - Welcome Screen
  const ctxTablet = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const pageTablet = await ctxTablet.newPage();
  await pageTablet.goto('http://localhost:3000/desk');
  await pageTablet.waitForTimeout(2000);
  await pageTablet.screenshot({ path: path.join(brainDir, 'mzuri_desk_welcome_tablet_1024.png'), fullPage: true });
  console.log('Saved mzuri_desk_welcome_tablet_1024.png');

  // Click on Men's Services to enter catalog view
  const menBtn = await pageTablet.locator('text="Men\'s Services"').first();
  await menBtn.click();
  await pageTablet.waitForTimeout(2000);
  await pageTablet.screenshot({ path: path.join(brainDir, 'mzuri_desk_catalog_tablet_1024.png'), fullPage: true });
  console.log('Saved mzuri_desk_catalog_tablet_1024.png');

  // Open variant modal for first service
  const selectBtn = await pageTablet.locator('button:has-text("Select")').first();
  await selectBtn.click();
  await pageTablet.waitForTimeout(1000);
  await pageTablet.screenshot({ path: path.join(brainDir, 'mzuri_desk_variant_sheet_tablet_1024.png') });
  console.log('Saved mzuri_desk_variant_sheet_tablet_1024.png');

  // 2. Desktop Viewport (1280x800)
  const ctxDesktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageDesktop = await ctxDesktop.newPage();
  await pageDesktop.goto('http://localhost:3000/desk');
  await pageDesktop.waitForTimeout(1500);
  await pageDesktop.locator('text="Women\'s Services"').first().click();
  await pageDesktop.waitForTimeout(2000);
  await pageDesktop.screenshot({ path: path.join(brainDir, 'mzuri_desk_catalog_desktop.png'), fullPage: true });
  console.log('Saved mzuri_desk_catalog_desktop.png');

  // 3. Mobile Viewport (390x844)
  const ctxMobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pageMobile = await ctxMobile.newPage();
  await pageMobile.goto('http://localhost:3000/desk');
  await pageMobile.waitForTimeout(1500);
  await pageMobile.screenshot({ path: path.join(brainDir, 'mzuri_desk_welcome_mobile_390.png'), fullPage: true });
  console.log('Saved mzuri_desk_welcome_mobile_390.png');

  await browser.close();
}

captureDesk().catch(err => {
  console.error(err);
  process.exit(1);
});
