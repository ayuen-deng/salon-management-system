const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

  await page.goto('http://localhost:3000/login');
  console.log('Login page loaded');

  // Select owner role tab first
  await page.click('button:has-text("Owner")');
  console.log('Selected Owner tab');

  await page.fill('input[type="text"]', 'owner');
  await page.fill('input[type="password"]', '111111');
  console.log('Filled credentials');

  await page.click('button[type="submit"]');
  console.log('Clicked submit');

  await page.waitForTimeout(4000);
  console.log('Current URL after submit:', page.url());

  const errEl = await page.$('.text-\\[\\#B42318\\]');
  if (errEl) {
    console.log('Error displayed:', await errEl.innerText());
  }

  await browser.close();
})();
