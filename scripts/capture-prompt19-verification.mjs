import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/PC/.gemini/antigravity/brain/e785eeb8-3e06-44ad-90aa-a088bcce5bd0';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // 1. Staff Portal Queue - Peter (Barber)
  console.log('Testing Staff Portal Queue for Peter...');
  const staffPage = await context.newPage();
  // Set active role cookie or user id if needed, or navigate directly to /staff
  await staffPage.goto('http://localhost:3000/staff');
  await staffPage.waitForTimeout(3000);
  await staffPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'mzuri_staff_queue_peter_pool.png'),
    fullPage: true,
  });
  console.log('Saved mzuri_staff_queue_peter_pool.png');

  // 2. Owner Dashboard & Attendance Modal
  console.log('Testing Owner Dashboard...');
  const ownerPage = await context.newPage();
  await ownerPage.goto('http://localhost:3000/owner');
  await ownerPage.waitForTimeout(3000);

  // Click on Staff Attendance Card to open modal
  const attendanceCard = await ownerPage.locator('button:has-text("Staff attendance")');
  if (await attendanceCard.count() > 0) {
    await attendanceCard.click();
    await ownerPage.waitForTimeout(1000);
    await ownerPage.screenshot({
      path: path.join(ARTIFACT_DIR, 'mzuri_owner_attendance_modal.png'),
    });
    console.log('Saved mzuri_owner_attendance_modal.png');
  } else {
    console.log('Staff attendance card button not found');
  }

  // 3. Reception Workspace - Attendance Topbar & Status Chips
  console.log('Testing Reception Workspace...');
  const receptionPage = await context.newPage();
  await receptionPage.goto('http://localhost:3000/reception');
  await receptionPage.waitForTimeout(3000);
  await receptionPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'mzuri_attendance_topbar_and_chips.png'),
    fullPage: true,
  });
  console.log('Saved mzuri_attendance_topbar_and_chips.png');

  await browser.close();
  console.log('All verification screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Error running playwright capture:', err);
  process.exit(1);
});
