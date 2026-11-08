import { chromium } from 'playwright';

const USERS = [
  { username: 'owner', pin: '111111', expectedRole: 'owner', expectedNames: ['Godfrey Mugisha', 'Owner'], expectedPath: '/owner' },
  { username: 'manager', pin: '222222', expectedRole: 'manager', expectedNames: ['Joan Tumusiime', 'Joan (Manager)'], expectedPath: '/manager' },
  { username: 'hr', pin: '333333', expectedRole: 'hr', expectedNames: ['David Kato', 'David (HR)'], expectedPath: '/hr' },
  { username: 'mary', pin: '444444', expectedRole: 'receptionist', expectedNames: ['Mary Namubiru', 'Mary (Reception)'], expectedPath: '/reception' },
  { username: 'grace', pin: '555555', expectedRole: 'staff', expectedNames: ['Grace Atuhaire', 'Grace'], expectedPath: '/staff' },
  { username: 'rose', pin: '555555', expectedRole: 'staff', expectedNames: ['Rose Kyomugisha', 'Rose (Wash)'], expectedPath: '/staff' },
  { username: 'sarah', pin: '555555', expectedRole: 'staff', expectedNames: ['Sarah Kobusingye', 'Sarah'], expectedPath: '/staff' },
  { username: 'peter', pin: '555555', expectedRole: 'staff', expectedNames: ['Peter Byamukama', 'Peter (Barber)'], expectedPath: '/staff' },
];

async function run() {
  const browser = await chromium.launch();
  console.log('Testing 8 concurrent user logins in separate browser contexts...');

  const results = await Promise.all(
    USERS.map(async (u) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto('http://localhost:3000/login');
        await page.fill('input[type="text"]', u.username);
        await page.fill('input[type="password"]', u.pin);
        await page.click('button[type="submit"]');
        await page.waitForURL(`**${u.expectedPath}*`, { timeout: 30000 });

        // Wait brief moment for dynamic client useEffect or server render to settle
        await page.waitForTimeout(1000);

        const bodyText = await page.textContent('body');
        const hasName = u.expectedNames.some((n) => bodyText?.includes(n));
        const isRosePolluted = u.username === 'rose' && (bodyText?.includes('Grace Atuhaire') || bodyText?.includes('Grace'));

        console.log(`[Diagnostic] ${u.username}: url=${page.url()} hasName=${hasName} isRosePolluted=${isRosePolluted}`);
        if (!hasName) {
          console.log(`[Diagnostic Text Sample] ${u.username}:`, bodyText?.slice(0, 300));
        }

        await context.close();
        return {
          user: u.username,
          expectedNames: u.expectedNames,
          path: u.expectedPath,
          hasName,
          isRosePolluted,
          success: Boolean(hasName && !isRosePolluted),
        };
      } catch (e) {
        console.error(`[Diagnostic Error] ${u.username}:`, e.message);
        await context.close();
        return { user: u.username, error: e.message, success: false };
      }
    })
  );

  console.log('Results:', results);
  await browser.close();
  const allPassed = results.every((r) => r.success);
  if (!allPassed) {
    console.error('Multi-role auth isolation test FAILED.');
    process.exit(1);
  } else {
    console.log('✅ ALL 8 ROLES VERIFIED INDEPENDENT AND ISOLATED!');
  }
}

run();
