import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/PC/.gemini/antigravity/brain/e785eeb8-3e06-44ad-90aa-a088bcce5bd0';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const ownerPage = await context.newPage();
  await ownerPage.goto('http://localhost:3000/owner');
  await ownerPage.waitForLoadState('networkidle');
  await ownerPage.waitForTimeout(3000);

  // Click on the Staff attendance card
  const card = ownerPage.locator('span:has-text("Staff attendance")');
  await card.click();
  await ownerPage.waitForTimeout(1500);

  await ownerPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'mzuri_owner_attendance_modal.png'),
  });
  console.log('Successfully saved mzuri_owner_attendance_modal.png!');

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
