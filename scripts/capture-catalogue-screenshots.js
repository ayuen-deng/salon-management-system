const { chromium } = require('playwright');
const path = require('path');

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // Navigate to login
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');

  // Fill in owner login
  await page.fill('input[type="text"]', 'owner');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Navigate to owner catalogue
  await page.goto('http://localhost:3000/owner/catalogue');
  await page.waitForTimeout(3000);

  const destPath = path.join(
    'C:', 'Users', 'PC', '.gemini', 'antigravity', 'brain',
    'e785eeb8-3e06-44ad-90aa-a088bcce5bd0', 'mzuri_catalogue_with_images_desktop.png'
  );
  await page.screenshot({ path: destPath, fullPage: true });
  console.log('Saved screenshot to:', destPath);

  // Also capture mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  const destMobile = path.join(
    'C:', 'Users', 'PC', '.gemini', 'antigravity', 'brain',
    'e785eeb8-3e06-44ad-90aa-a088bcce5bd0', 'mzuri_catalogue_with_images_mobile_390.png'
  );
  await page.screenshot({ path: destMobile, fullPage: true });
  console.log('Saved mobile screenshot to:', destMobile);

  await browser.close();
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
