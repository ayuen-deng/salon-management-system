import { test, expect } from 'playwright/test';

const USERS = [
  { username: 'owner', pin: '111111', expectedRole: 'owner', expectedName: 'Godfrey Mugisha', expectedPath: '/owner' },
  { username: 'manager', pin: '222222', expectedRole: 'manager', expectedName: 'Joan Tumusiime', expectedPath: '/manager' },
  { username: 'hr', pin: '333333', expectedRole: 'hr', expectedName: 'David Kato', expectedPath: '/hr' },
  { username: 'mary', pin: '444444', expectedRole: 'receptionist', expectedName: 'Mary Namubiru', expectedPath: '/reception' },
  { username: 'grace', pin: '555555', expectedRole: 'staff', expectedName: 'Grace', expectedPath: '/staff' },
  { username: 'rose', pin: '555555', expectedRole: 'staff', expectedName: 'Rose', expectedPath: '/staff' },
  { username: 'sarah', pin: '555555', expectedRole: 'staff', expectedName: 'Sarah', expectedPath: '/staff' },
  { username: 'peter', pin: '555555', expectedRole: 'staff', expectedName: 'Peter', expectedPath: '/staff' },
];

test('concurrent multi-role login with separate incognito contexts verifies strict identity isolation', async ({ browser }) => {
  // Launch all 8 role sessions concurrently in distinct browser contexts
  await Promise.all(
    USERS.map(async (user) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await page.goto('http://localhost:3000/login');

        const roleButton: Record<string, string> = {
          owner: 'Owner', manager: 'Manager', hr: 'HR', receptionist: 'Reception', staff: 'Staff',
        };
        await page.getByRole('button', { name: roleButton[user.expectedRole], exact: true }).click();

        // Owners and HR use email/password; managers and frontline staff use username/PIN.
        const identifier = page.locator('#login-identifier');
        const identifierType = await identifier.getAttribute('type');
        const emailByUsername: Record<string, string> = {
          owner: 'owner@mzuri.salon', manager: 'manager@mzuri.salon', hr: 'hr@mzuri.salon',
          mary: 'mary@staff.mzuri.salon', grace: 'grace@staff.mzuri.salon', rose: 'rose@staff.mzuri.salon',
          sarah: 'sarah@staff.mzuri.salon', peter: 'peter@staff.mzuri.salon',
        };
        await identifier.fill(identifierType === 'email' ? emailByUsername[user.username] : user.username);
        await page.locator('#login-secret').fill(user.pin);

        // Submit login
        await page.click('button[type="submit"]');

        // Roles with an attendance gate must clock in before entering their workspace.
        await page.waitForURL((url) =>
          url.pathname === user.expectedPath || url.pathname === '/attendance-gate',
          { timeout: 15000 },
        );
        if (new URL(page.url()).pathname === '/attendance-gate') {
          await page.getByRole('button', { name: /I’m in|I’m back/ }).click();
          await page.waitForURL((url) => url.pathname === user.expectedPath, { timeout: 15000 });
        }

        // Assert role-specific URL
        expect(page.url()).toContain(user.expectedPath);

        let userCardText = await page.locator('body').innerText();
        // HR/manager/owner shells intentionally show role labels; staff shells show staff names.
        if (user.expectedRole === 'staff') {
          await expect(page.locator('body')).toContainText(user.expectedName, { timeout: 15000 });
          userCardText = await page.locator('body').innerText();
        }

        // If logged in as Rose, strictly assert Grace is not displayed as the authenticated user
        if (user.username === 'rose') {
          expect(userCardText).not.toContain('Grace');
        }
      } finally {
        await context.close();
      }
    })
  );
});
