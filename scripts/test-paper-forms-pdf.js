const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\e785eeb8-3e06-44ad-90aa-a088bcce5bd0';

async function testForms() {
  console.log('Launching browser to test paper forms print rendering and screenshots...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1600 },
  });
  const page = await context.newPage();

  const testCases = [
    {
      name: 'visit-sheet',
      url: 'http://localhost:3000/print/forms/visit-sheet?count=2&start=1',
      screenshot: 'mzuri_form_visit_sheet.png',
      pdf: 'mzuri_form_visit_sheet.pdf',
    },
    {
      name: 'queue-sheet',
      url: 'http://localhost:3000/print/forms/queue-sheet',
      screenshot: 'mzuri_form_queue_sheet.png',
      pdf: 'mzuri_form_queue_sheet.pdf',
    },
    {
      name: 'manager-sheet',
      url: 'http://localhost:3000/print/forms/manager-sheet',
      screenshot: 'mzuri_form_manager_sheet.png',
      pdf: 'mzuri_form_manager_sheet.pdf',
    },
    {
      name: 'cash-count',
      url: 'http://localhost:3000/print/forms/cash-count',
      screenshot: 'mzuri_form_cash_count.png',
      pdf: 'mzuri_form_cash_count.pdf',
    },
  ];

  for (const tc of testCases) {
    console.log(`Testing route: ${tc.url}`);
    await page.goto(tc.url, { waitUntil: 'networkidle' });

    // Assert absence of UI chrome
    const pageContent = await page.content();
    const forbiddenStrings = [
      'Demo data environment',
      'Switch role',
      'Today in salon',
      'Reception Dashboard',
      'Owner Dashboard',
    ];

    for (const forbidden of forbiddenStrings) {
      if (pageContent.includes(forbidden)) {
        throw new Error(`Forbidden chrome "${forbidden}" found in print route ${tc.url}`);
      }
    }
    console.log(`  ✓ Zero app chrome confirmed for ${tc.name}`);

    // Capture visual screenshot
    const screenshotPath = path.join(ARTIFACT_DIR, tc.screenshot);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  ✓ Screenshot saved: ${screenshotPath}`);

    // Generate A4 PDF
    const pdfPath = path.join(ARTIFACT_DIR, tc.pdf);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '12mm', right: '12mm' },
    });
    console.log(`  ✓ PDF saved: ${pdfPath}`);
  }

  // Also take screenshot of the updated Paper Forms index view in reception
  console.log('Testing Paper Forms index view at /reception/paper-forms...');
  await page.goto('http://localhost:3000/reception/paper-forms', { waitUntil: 'networkidle' });
  const indexScreenshotPath = path.join(ARTIFACT_DIR, 'mzuri_paper_forms_index.png');
  await page.screenshot({ path: indexScreenshotPath, fullPage: true });
  console.log(`  ✓ Paper Forms index screenshot saved: ${indexScreenshotPath}`);

  // Also take screenshot of Enter from paper view at /reception/enter-from-paper
  console.log('Testing Enter From Paper view at /reception/enter-from-paper...');
  await page.goto('http://localhost:3000/reception/enter-from-paper', { waitUntil: 'networkidle' });
  const entryScreenshotPath = path.join(ARTIFACT_DIR, 'mzuri_enter_from_paper.png');
  await page.screenshot({ path: entryScreenshotPath, fullPage: true });
  console.log(`  ✓ Enter from paper screenshot saved: ${entryScreenshotPath}`);

  await browser.close();
  console.log('All print routes and paper views verified successfully!');
}

testForms().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
