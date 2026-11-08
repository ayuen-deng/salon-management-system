const { chromium } = require('playwright');
const path = require('path');

async function captureStaffScreens() {
  const browser = await chromium.launch({ headless: true });
  const brainDir = path.join('C:', 'Users', 'PC', '.gemini', 'antigravity', 'brain', 'e785eeb8-3e06-44ad-90aa-a088bcce5bd0');

  // Staff mobile phone viewport (390x844)
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  // 1. Login as staff member
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="text"]', 'grace');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // 2. Staff Queue View (/staff)
  await page.goto('http://localhost:3000/staff');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(brainDir, 'mzuri_staff_queue_central_mobile_390.png'), fullPage: true });
  console.log('Saved mzuri_staff_queue_central_mobile_390.png');

  // 3. Staff Appointments Tab (/staff/appointments)
  await page.goto('http://localhost:3000/staff/appointments');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(brainDir, 'mzuri_staff_appointments_tab_mobile_390.png'), fullPage: true });
  console.log('Saved mzuri_staff_appointments_tab_mobile_390.png');

  // 4. Staff Target Tab (/staff/target)
  await page.goto('http://localhost:3000/staff/target');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(brainDir, 'mzuri_staff_target_tab_mobile_390.png'), fullPage: true });
  console.log('Saved mzuri_staff_target_tab_mobile_390.png');

  // 5. Staff History Tab (/staff/history)
  await page.goto('http://localhost:3000/staff/history');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(brainDir, 'mzuri_staff_history_tab_mobile_390.png'), fullPage: true });
  console.log('Saved mzuri_staff_history_tab_mobile_390.png');

  // 6. Desktop Queue View (1280x800)
  const ctxDesktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const pageDesktop = await ctxDesktop.newPage();
  await pageDesktop.goto('http://localhost:3000/login');
  await pageDesktop.fill('input[type="text"]', 'grace');
  await pageDesktop.fill('input[type="password"]', '123456');
  await pageDesktop.click('button[type="submit"]');
  await pageDesktop.waitForTimeout(2000);
  await pageDesktop.goto('http://localhost:3000/staff');
  await pageDesktop.waitForTimeout(2000);
  await pageDesktop.screenshot({ path: path.join(brainDir, 'mzuri_staff_queue_desktop.png'), fullPage: true });
  console.log('Saved mzuri_staff_queue_desktop.png');

  await browser.close();
}

captureStaffScreens().catch(err => {
  console.error(err);
  process.exit(1);
});
