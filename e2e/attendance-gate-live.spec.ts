import { expect, test, type Browser, type BrowserContextOptions } from 'playwright/test';
import { mkdirSync } from 'node:fs';

const username = process.env.ATTENDANCE_GATE_USERNAME;
const pin = process.env.ATTENDANCE_GATE_PIN;
const role = process.env.ATTENDANCE_GATE_ROLE || 'manager';
const roleTab: Record<string, string> = { manager: 'Manager', receptionist: 'Reception', hr: 'HR', staff: 'Staff' };
const rolePath: Record<string, string> = { manager: '/manager', receptionist: '/reception', hr: '/hr', staff: '/staff' };

async function reviewViewport(browser: Browser, viewport: NonNullable<BrowserContextOptions['viewport']>, proofName: string) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByRole('button', { name: roleTab[role], exact: true }).click();
  await page.locator('#login-identifier').fill(username!);
  await page.locator('#login-secret').fill(pin!);
  await page.getByRole('button', { name: `Sign in as ${roleTab[role]}` }).click();
  try {
    await page.waitForURL((url) => url.pathname === '/attendance-gate' || url.pathname === rolePath[role], { timeout: 20000 });
  } catch {
    const loginError = await page.getByRole('alert').innerText().catch(() => 'Sign-in did not complete.');
    await page.locator('#login-secret').fill('');
    throw new Error(`Could not reach the authorized workspace: ${loginError}`);
  }

  if (new URL(page.url()).pathname === '/attendance-gate') {
    await expect(page.getByRole('heading', { name: 'Attendance check' })).toBeVisible();
    await expect(page.getByRole('button', { name: /I’m in|I’m back/ })).toBeVisible();
    await expect(page.getByText('Clock in to continue', { exact: true })).toHaveCount(0);
  } else {
    await expect(page).toHaveURL(new RegExp(`${rolePath[role]}$`));
  }

  mkdirSync('artifacts/phase2-review', { recursive: true });
  await page.screenshot({ path: `artifacts/phase2-review/${proofName}.png`, fullPage: true });
  await context.close();
}

test('attendance gate presents safely at desktop and phone widths for one authorized role', async ({ browser }) => {
  test.skip(!username || !pin, 'Requires an authorized review account supplied through ATTENDANCE_GATE_USERNAME and ATTENDANCE_GATE_PIN.');
  test.skip(!roleTab[role], 'ATTENDANCE_GATE_ROLE must be manager, receptionist, hr, or staff.');
  await reviewViewport(browser, { width: 1440, height: 900 }, `${role}-desktop`);
  await reviewViewport(browser, { width: 390, height: 844 }, `${role}-mobile`);
});
