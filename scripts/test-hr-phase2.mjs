import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:3000';
const OUT_DIR = 'C:/Users/PC/.gemini/antigravity/brain/e785eeb8-3e06-44ad-90aa-a088bcce5bd0';

async function run() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Context (1280x800)
  const desktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await desktopCtx.newPage();

  console.log('Logging in as HR (David Kato)...');
  await page.goto(`${BASE_URL}/login?role=hr`);
  await page.fill('input[type="text"]', 'hr');
  await page.fill('input[type="password"]', '333333');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/hr', { timeout: 30000 });
  await page.waitForTimeout(1000);

  // Capture Attendance
  console.log('Navigating to HR Attendance...');
  await page.goto(`${BASE_URL}/hr/attendance`);
  await page.waitForSelector('table tbody tr td:not([colspan])', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  console.log('Capturing HR Attendance (Desktop)...');
  await page.screenshot({ path: `${OUT_DIR}/hr_attendance_desktop.png`, fullPage: true });

  // Capture Leave
  console.log('Navigating to HR Leave...');
  await page.goto(`${BASE_URL}/hr/leave`);
  await page.waitForSelector('table tbody tr td:not([colspan])', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  console.log('Capturing HR Leave (Desktop)...');
  await page.screenshot({ path: `${OUT_DIR}/hr_leave_desktop.png`, fullPage: true });

  // Capture Rota
  console.log('Navigating to HR Rota...');
  await page.goto(`${BASE_URL}/hr/rota`);
  await page.waitForSelector('table tbody tr td:not([colspan])', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log('Capturing HR Rota (Desktop)...');
  await page.screenshot({ path: `${OUT_DIR}/hr_rota_desktop.png`, fullPage: true });

  // Capture Performance
  console.log('Navigating to HR Performance...');
  await page.goto(`${BASE_URL}/hr/performance`);
  await page.waitForSelector('table tbody tr td:not([colspan])', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  console.log('Capturing HR Performance (Desktop)...');
  await page.screenshot({ path: `${OUT_DIR}/hr_performance_desktop.png`, fullPage: true });

  // Capture Audit
  console.log('Navigating to HR Audit...');
  await page.goto(`${BASE_URL}/hr/audit`);
  await page.waitForSelector('table tbody tr td:not([colspan])', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  console.log('Capturing HR Audit (Desktop)...');
  await page.screenshot({ path: `${OUT_DIR}/hr_audit_desktop.png`, fullPage: true });

  await desktopCtx.close();

  // 2. Tablet Context (1024x768)
  const tabletCtx = await browser.newContext({
    viewport: { width: 1024, height: 768 },
  });
  const tabletPage = await tabletCtx.newPage();

  console.log('Logging in as HR on Tablet (1024px)...');
  await tabletPage.goto(`${BASE_URL}/login?role=hr`);
  await tabletPage.fill('input[type="text"]', 'hr');
  await tabletPage.fill('input[type="password"]', '333333');
  await tabletPage.click('button[type="submit"]');
  await tabletPage.waitForURL('**/hr', { timeout: 30000 });
  await tabletPage.waitForTimeout(1000);

  console.log('Capturing HR Attendance (Tablet 1024px)...');
  await tabletPage.goto(`${BASE_URL}/hr/attendance`);
  await tabletPage.waitForSelector('table tbody tr td:not([colspan])', { timeout: 15000 }).catch(() => {});
  await tabletPage.waitForTimeout(1000);
  await tabletPage.screenshot({ path: `${OUT_DIR}/hr_attendance_tablet_1024.png`, fullPage: true });

  console.log('Capturing HR Leave (Tablet 1024px)...');
  await tabletPage.goto(`${BASE_URL}/hr/leave`);
  await tabletPage.waitForSelector('table tbody tr td:not([colspan])', { timeout: 15000 }).catch(() => {});
  await tabletPage.waitForTimeout(1000);
  await tabletPage.screenshot({ path: `${OUT_DIR}/hr_leave_tablet_1024.png`, fullPage: true });

  console.log('Capturing HR Rota (Tablet 1024px)...');
  await tabletPage.goto(`${BASE_URL}/hr/rota`);
  await tabletPage.waitForSelector('table tbody tr td:not([colspan])', { timeout: 15000 }).catch(() => {});
  await tabletPage.waitForTimeout(2000);
  await tabletPage.screenshot({ path: `${OUT_DIR}/hr_rota_tablet_1024.png`, fullPage: true });

  console.log('Capturing HR Performance (Tablet 1024px)...');
  await tabletPage.goto(`${BASE_URL}/hr/performance`);
  await tabletPage.waitForSelector('table tbody tr td:not([colspan])', { timeout: 15000 }).catch(() => {});
  await tabletPage.waitForTimeout(1000);
  await tabletPage.screenshot({ path: `${OUT_DIR}/hr_performance_tablet_1024.png`, fullPage: true });

  console.log('Capturing HR Audit (Tablet 1024px)...');
  await tabletPage.goto(`${BASE_URL}/hr/audit`);
  await tabletPage.waitForSelector('table tbody tr td:not([colspan])', { timeout: 15000 }).catch(() => {});
  await tabletPage.waitForTimeout(1000);
  await tabletPage.screenshot({ path: `${OUT_DIR}/hr_audit_tablet_1024.png`, fullPage: true });

  // Isolation Text Scan check: assert NO financial or customer words on pages
  console.log('Running Isolation privacy text scan across HR Phase 2 pages...');
  const pagesToScan = ['/hr/attendance', '/hr/leave', '/hr/rota', '/hr/performance', '/hr/audit'];
  const forbiddenTerms = ['UGX', 'revenue', 'receipt', 'payment', 'total_final'];

  for (const p of pagesToScan) {
    await tabletPage.goto(`${BASE_URL}${p}`);
    await tabletPage.waitForTimeout(1000);
    const content = await tabletPage.content();
    for (const term of forbiddenTerms) {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        console.error(`🚨 LEAK DETECTED on ${p}: Found forbidden term "${term}"!`);
        process.exit(1);
      }
    }
  }

  console.log('✅ Isolation privacy text scan passed with 0 leaks across all Phase 2 pages.');
  await tabletCtx.close();
  await browser.close();
  console.log('✅ All Phase 2 screenshots and isolation tests completed successfully.');
}

run().catch((err) => {
  console.error('Error during test:', err);
  process.exit(1);
});
