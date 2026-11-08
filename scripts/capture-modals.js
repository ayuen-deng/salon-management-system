const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/PC/.gemini/antigravity/brain/e785eeb8-3e06-44ad-90aa-a088bcce5bd0';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating directly to /owner...');
  await page.goto('http://localhost:3000/owner');
  await page.waitForLoadState('networkidle');

  // Wait for data to render
  await page.waitForSelector('text=Revenue today', { timeout: 10000 });
  console.log('Owner dashboard loaded successfully!');

  // Take full dashboard screenshot
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_owner_dashboard_live.png') });

  // 1. Click "Today in salon"
  console.log('Clicking "Today in salon"...');
  await page.locator('text=Today in salon').first().click();
  await page.waitForSelector('text=Today in Salon (Activity Details)');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_owner_modal_activity_desktop.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // 2. Click "Staff attendance"
  console.log('Clicking "Staff attendance"...');
  await page.locator('text=Staff attendance').first().click();
  await page.waitForSelector('text=Staff Attendance Today');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_owner_modal_attendance_desktop.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // 3. Click "Revenue today"
  console.log('Clicking "Revenue today"...');
  await page.locator('text=Revenue today').first().click();
  await page.waitForSelector('text=Revenue Today Breakdown');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_owner_modal_revenue_desktop.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // 4. Click "Mobile Money verification"
  console.log('Clicking "Mobile Money verification"...');
  await page.locator('text=Mobile Money verification').first().click();
  await page.waitForSelector('text=Mobile Money Verification Details');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_owner_modal_momo_desktop.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Mobile Viewport (390px)
  console.log('Testing mobile 390px bottom sheet modal...');
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3000/owner');
  await mobilePage.waitForLoadState('networkidle');

  await mobilePage.waitForSelector('text=Today in salon');
  await mobilePage.locator('text=Today in salon').first().click();
  await mobilePage.waitForSelector('text=Today in Salon (Activity Details)');
  await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_owner_modal_activity_mobile_390.png') });

  await browser.close();
  console.log('All 5 modal screenshots captured successfully!');
})();
