import { test, expect } from 'playwright/test';

test.describe('Design System Audit & Computed Style Verification', () => {
  test('login page conforms to modern blue and black theme with Inter font', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    // Verify wordmark
    const wordmark = page.locator('text=Mzuri Unisex Salon').first();
    await expect(wordmark).toBeVisible();

    // Verify font family is Inter or sans-serif
    const bodyFont = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });
    expect(bodyFont.toLowerCase()).toContain('inter');

    // Check button primary blue color
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    const btnBg = await submitBtn.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    // rgb(31, 79, 216) is #1F4FD8
    expect(btnBg).toBe('rgb(31, 79, 216)');
  });

  test('queue display screen conforms to dark background with near-black ink', async ({ page }) => {
    await page.goto('http://localhost:3000/display/queue');
    await page.waitForLoadState('networkidle');

    // Background should be #0A0E14 -> rgb(10, 14, 20)
    const container = page.locator('main > div.min-h-screen');
    const bg = await container.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
    expect(bg).toBe('rgb(10, 14, 20)');

    // Headings
    await expect(page.getByRole('heading', { name: 'Now serving' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Next' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Waiting' })).toBeVisible();
  });

  test('unpaired kiosk tablet displays the pairing gate before customer data', async ({ page }) => {
    await page.goto('http://localhost:3000/desk', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Pair this tablet' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel('Pairing code')).toHaveAttribute('maxlength', '6');
    await expect(page.getByRole('button', { name: 'Pair tablet' })).toBeDisabled();
    await expect(page.getByText(/Welcome to Mzuri Unisex Salon/)).toHaveCount(0);
  });
});
