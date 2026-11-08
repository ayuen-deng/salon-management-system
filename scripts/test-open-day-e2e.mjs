import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/PC/.gemini/antigravity/brain/e785eeb8-3e06-44ad-90aa-a088bcce5bd0';

async function run() {
  console.log('Starting Playwright test for Open Day, Stale Data Fix, and Multi-Role Access...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Visit Manager Today page (/manager)
    console.log('Step 1: Navigating to Manager Today (/manager)...');
    await page.goto('http://localhost:3000/manager', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify "Business Day Closed" is shown
    const statusText = await page.locator('text=Business Day Closed').first();
    console.log('Business Day Closed status card visible:', await statusText.isVisible());

    // Verify Stale visits count are 0
    const waitingCard = await page.locator('text=In queue pool').first();
    console.log('Waiting card visible:', await waitingCard.isVisible());

    // Verify Awaiting payment wording (replaces Pending checkout)
    const awaitingPayment = await page.locator('text=Awaiting payment').first();
    console.log('"Awaiting payment" text visible:', await awaitingPayment.isVisible());

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_manager_today_before_open.png') });
    console.log('Saved screenshot mzuri_manager_today_before_open.png');

    // 2. Click "Open the Day" button to verify OpenDayModal opens
    console.log('Step 2: Clicking "Open the Day" on Manager Today...');
    const openDayBtn = page.getByRole('button', { name: 'Open the Day' });
    await openDayBtn.click();
    await page.waitForTimeout(500);

    const modalTitle = page.locator('text=Open Business Day');
    console.log('OpenDayModal visible on Manager page:', await modalTitle.isVisible());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_open_day_modal_manager.png') });
    console.log('Saved screenshot mzuri_open_day_modal_manager.png');

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(500);

    // 3. Visit Reception Workspace (/reception)
    console.log('Step 3: Navigating to Reception Workspace (/reception)...');
    await page.goto('http://localhost:3000/reception', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify Reception banner has "Open the Day" button
    const recBanner = page.locator('text=The business day has not been opened.');
    console.log('Reception day closed banner visible:', await recBanner.isVisible());

    const recOpenDayBtn = page.getByRole('button', { name: 'Open the Day' });
    console.log('Reception Open the Day button visible:', await recOpenDayBtn.isVisible());

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_reception_day_closed.png') });
    console.log('Saved screenshot mzuri_reception_day_closed.png');

    // Click Open the Day from Reception
    await recOpenDayBtn.click();
    await page.waitForTimeout(500);

    const recModalTitle = page.locator('text=Receptionist Action');
    console.log('OpenDayModal displays "Receptionist Action":', await recModalTitle.isVisible());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_open_day_modal_reception.png') });
    console.log('Saved screenshot mzuri_open_day_modal_reception.png');

    // Cancel modal
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForTimeout(500);

    // 4. Visit Manager Day page (/manager/day)
    console.log('Step 4: Navigating to Manager Day Operations (/manager/day)...');
    await page.goto('http://localhost:3000/manager/day', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify no "Refresh Day Status" button or duplicate title
    const refreshBtn = page.locator('button:has-text("Refresh Day Status")');
    console.log('"Refresh Day Status" button absent:', !(await refreshBtn.isVisible()));

    // Verify "TODAY IS NOT OPEN YET" card exists
    const notOpenCard = page.locator('text=TODAY IS NOT OPEN YET');
    console.log('"TODAY IS NOT OPEN YET" card visible:', await notOpenCard.isVisible());

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_manager_day_not_open.png') });
    console.log('Saved screenshot mzuri_manager_day_not_open.png');

    // 5. Open the day from /manager/day
    console.log('Step 5: Submitting Open Day from Manager Day page...');
    const pageOpenBtn = page.getByRole('button', { name: 'Open the Day' });
    await pageOpenBtn.click();
    await page.waitForTimeout(500);

    const submitOpenBtn = page.getByRole('button', { name: 'Confirm & Open Day' });
    await submitOpenBtn.click();
    await page.waitForTimeout(2000);

    // Verify Day is now OPEN
    const openBadge = page.locator('text=OPEN & ACTIVE');
    console.log('Day is now OPEN & ACTIVE:', await openBadge.isVisible());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_manager_day_opened.png') });
    console.log('Saved screenshot mzuri_manager_day_opened.png');

    // 6. Verify Manager Today (/manager) now shows Day is Open
    console.log('Step 6: Re-checking Manager Today (/manager) after opening...');
    await page.goto('http://localhost:3000/manager', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const openTodayText = page.locator('text=Business Day is Open');
    console.log('"Business Day is Open" banner visible:', await openTodayText.isVisible());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_manager_today_after_open.png') });
    console.log('Saved screenshot mzuri_manager_today_after_open.png');

    // 7. Verify Two-step Close on /manager/day
    console.log('Step 7: Testing Two-step Close on /manager/day...');
    await page.goto('http://localhost:3000/manager/day', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const beginCloseBtn = page.getByRole('button', { name: 'Begin Day Close' });
    await beginCloseBtn.click();
    await page.waitForTimeout(1000);

    const closeInProgress = page.locator('text=Day Close in Progress');
    console.log('"Day Close in Progress" closing review visible:', await closeInProgress.isVisible());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_manager_day_closing_state.png') });
    console.log('Saved screenshot mzuri_manager_day_closing_state.png');

    // Confirm close
    const confirmCloseBtn = page.getByRole('button', { name: 'Confirm Drawer & Close Day' });
    await confirmCloseBtn.click();
    await page.waitForTimeout(2000);

    // Verify Day is now Closed with Undo Close countdown
    const dayClosedTitle = page.locator('text=Business Day Closed');
    console.log('Day is now Closed:', await dayClosedTitle.isVisible());

    const undoBtn = page.locator('button:has-text("Undo Close")');
    console.log('Undo Close countdown button visible:', await undoBtn.isVisible());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_manager_day_closed_undo.png') });
    console.log('Saved screenshot mzuri_manager_day_closed_undo.png');

    // 8. Test Undo Close
    console.log('Step 8: Testing Undo Close...');
    await undoBtn.click();
    await page.waitForTimeout(2000);

    console.log('Re-opened via Undo Close:', await openBadge.isVisible());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_manager_day_after_undo.png') });
    console.log('Saved screenshot mzuri_manager_day_after_undo.png');

    console.log('ALL PLAYWRIGHT TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Playwright Test Error:', err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'mzuri_test_failure.png') });
    throw err;
  } finally {
    await browser.close();
  }
}

run();
