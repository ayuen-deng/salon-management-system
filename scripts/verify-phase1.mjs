import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/PC/.gemini/antigravity/brain/e785eeb8-3e06-44ad-90aa-a088bcce5bd0';

async function testPhase1() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // 1. Login as Receptionist (Mary / 444444)
  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("Reception")');
  await page.waitForTimeout(300);
  await page.fill('input[type="text"]', 'mary');
  await page.fill('input[type="password"]', '444444');
  console.log('Submitting login...');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/reception**', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Take screenshot of reception queue (A01 is gone from the live queue!)
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mzuri_phase1_reception_queue_cleared.png'),
    fullPage: true,
  });
  console.log('Saved mzuri_phase1_reception_queue_cleared.png');

  // 2. Test Attendance persistence across multiple page navigations
  console.log('Testing attendance persistence...');
  const inBtn = page.locator('button:has-text("In")').first();
  if (await inBtn.count() > 0) {
    await inBtn.click();
    await page.waitForTimeout(1000);
  }

  // Navigate to Appointments
  console.log('Navigating to Appointments...');
  await page.goto('http://localhost:3000/reception/appointments');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Navigate to Customers
  console.log('Navigating to Customers...');
  await page.goto('http://localhost:3000/reception/customers');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Navigate to Cash Drawer
  console.log('Navigating to Cash Drawer...');
  await page.goto('http://localhost:3000/reception/cash-drawer');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Navigate back to Reception
  console.log('Navigating back to Reception...');
  await page.goto('http://localhost:3000/reception');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'mzuri_phase1_attendance_persisted.png'),
    fullPage: true,
  });
  console.log('Saved mzuri_phase1_attendance_persisted.png');

  await browser.close();
  console.log('Phase 1 test complete!');
}

testPhase1().catch(err => {
  console.error('Phase 1 test error:', err);
  process.exit(1);
});
