import { test, expect } from 'playwright/test';

async function signInAsStaff(page: import('playwright/test').Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Staff' }).click();
  await page.getByLabel('Username').fill(process.env.E2E_STAFF_USERNAME || 'grace');
  await page.getByLabel('PIN').fill(process.env.E2E_STAFF_PIN || '555555');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/staff**', { timeout: 20000 });
}

test('staff leave page renders private balance and request controls at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsStaff(page);
  await page.goto('/staff/leave');
  await expect(page.getByRole('heading', { name: 'My leave' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Request leave' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Operational User');
});

test('staff can request then cancel a non-annual leave request', async ({ page }) => {
  test.skip(process.env.E2E_STAFF_LEAVE_MUTATIONS !== 'true', 'Set E2E_STAFF_LEAVE_MUTATIONS=true against seeded demo data to run the database mutation flow.');
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsStaff(page);
  await page.goto('/staff/leave');
  await page.getByLabel('Leave type').selectOption('other_approved_leave');

  let selected = false;
  const date = new Date(`${new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kampala'}).format(new Date())}T12:00:00+03:00`);
  for (let attempt = 0; attempt < 12 && !selected; attempt += 1) {
    date.setDate(date.getDate() + 14);
    const value = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Kampala'}).format(date);
    await page.getByLabel('From').fill(value);
    await page.getByLabel('To').fill(value);
    await expect(page.getByText(/working day/)).toBeVisible();
    const warnings = await page.locator('form').innerText();
    selected = !warnings.includes('overlap') && !warnings.includes('no scheduled working days');
  }
  test.skip(!selected, 'No non-overlapping scheduled day found in the preview window.');

  await page.getByRole('button', { name: 'Send leave request' }).click();
  await expect(page.getByText('Your leave request was sent to HR.')).toBeVisible();
  const request = page.locator('text=Other approved leave').last().locator('..');
  await request.getByRole('button', { name: 'Cancel request' }).click();
  await expect(page.getByText('Pending request cancelled.')).toBeVisible();
});
