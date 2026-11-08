import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  // Click Receptionist tab
  await page.click('button:has-text("Reception")');
  await page.waitForTimeout(300);
  await page.fill('input[type="text"]', 'mary');
  await page.fill('input[type="password"]', '444444');
  console.log('Submitting login form...');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  console.log('Current URL after submit:', page.url());
  const error = await page.locator('.bg-rose-50').textContent().catch(() => null);
  console.log('Error text:', error);
  await browser.close();
}
test();
