import { expect, test } from 'playwright/test';

test.describe('kiosk order entry', () => {
  test('starts at tablet pairing and does not present a queue ticket before payment', async ({ page }) => {
    await page.goto('/desk', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Pair this tablet' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel('Pairing code')).toHaveAttribute('maxlength', '6');
    await expect(page.getByText(/queue ticket/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pair tablet' })).toBeDisabled();
  });

  test('places a paired kiosk order and shows its K code, masked phone, and payment-first message', async ({ page }) => {
    test.setTimeout(60000);
    test.skip(!process.env.KIOSK_E2E_PAIRING_CODE, 'Requires a temporary paired test device in the live Supabase project.');
    await page.goto('/desk', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Pairing code')).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Pairing code').fill(process.env.KIOSK_E2E_PAIRING_CODE!);
    await page.getByRole('button', { name: 'Pair tablet' }).click();
    await expect(page.getByRole('heading', { name: /Welcome to Mzuri Unisex Salon/ })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Men's Services/ }).click();
    await page.getByRole('button', { name: 'Select', exact: true }).first().click();
    await page.getByRole('button', { name: 'Add', exact: true }).first().click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: /Review & Confirm/ }).click();
    await page.getByRole('button', { name: 'Continue to Identification', exact: true }).click();

    await page.getByPlaceholder('e.g. David, Grace, Ronald').fill('king tut');
    for (const digit of '0788568555') await page.getByRole('button', { name: digit, exact: true }).click();
    await page.getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Confirm Your Visit Details' })).toBeVisible();
    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page.getByText('Your order number')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('body')).toContainText(/K\d{2}/);
    await expect(page.locator('body')).toContainText('King Tut');
    await expect(page.locator('body')).toContainText('0788 *** 555');
    await expect(page.locator('body')).toContainText('Your place in the queue starts after payment.');
    await page.screenshot({ path: 'test-results/kiosk-order-confirmation.png', fullPage: true });
  });
});
