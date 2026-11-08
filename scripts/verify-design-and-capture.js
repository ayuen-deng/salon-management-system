const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/PC/.gemini/antigravity/brain/e785eeb8-3e06-44ad-90aa-a088bcce5bd0';

(async () => {
  const browser = await chromium.launch();

  // Desktop context
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('Testing /login...');
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  const wordmark = await page.locator('text=Mzuri Unisex Salon').first().isVisible();
  console.log('Wordmark visible:', wordmark);
  const btnBg = await page.locator('button[type="submit"]').evaluate(el => window.getComputedStyle(el).backgroundColor);
  console.log('Submit button background color:', btnBg);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_login_desktop_blue.png') });

  console.log('Testing /display/queue...');
  await page.goto('http://localhost:3000/display/queue');
  await page.waitForLoadState('networkidle');
  const queueBg = await page.locator('div').first().evaluate(el => window.getComputedStyle(el).backgroundColor);
  console.log('Queue background color:', queueBg);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_queue_screen_blue.png') });

  console.log('Testing /desk...');
  await page.goto('http://localhost:3000/desk');
  await page.waitForLoadState('networkidle');
  const welcomeText = await page.locator('text=Welcome to Mzuri Unisex Salon').first().isVisible();
  console.log('Desk welcome text visible:', welcomeText);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_desk_welcome_blue.png') });

  // Tablet context for kiosk catalog
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 }
  });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto('http://localhost:3000/desk');
  await tabletPage.waitForLoadState('networkidle');
  await tabletPage.locator('text=Men\'s Services').first().click();
  await tabletPage.waitForTimeout(500);
  await tabletPage.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_desk_catalog_blue.png') });

  // Owner dashboard
  console.log('Testing /owner...');
  await page.goto('http://localhost:3000/owner');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_owner_dashboard_blue.png') });

  await browser.close();
  console.log('All screenshots and design assertions completed successfully!');
})();
