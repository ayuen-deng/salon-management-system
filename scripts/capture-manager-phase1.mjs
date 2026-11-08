import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function captureManagerScreenshots() {
  const artifactDir = 'C:/Users/PC/.gemini/antigravity/brain/e785eeb8-3e06-44ad-90aa-a088bcce5bd0';
  const browser = await chromium.launch({ headless: true });

  const pagesToCapture = [
    { name: 'manager_today', url: 'http://localhost:3000/manager' },
    { name: 'manager_approvals', url: 'http://localhost:3000/manager/approvals' },
    { name: 'manager_queue', url: 'http://localhost:3000/manager/queue' },
    { name: 'manager_visits', url: 'http://localhost:3000/manager/visits' },
    { name: 'manager_payments', url: 'http://localhost:3000/manager/payments' },
  ];

  for (const pageConfig of pagesToCapture) {
    // 1. Desktop (1280x800)
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const desktopPage = await desktopContext.newPage();
    try {
      await desktopPage.goto(pageConfig.url, { waitUntil: 'networkidle', timeout: 30000 });
      await desktopPage.waitForTimeout(2000); // allow data hydration
      const desktopPath = path.join(artifactDir, `${pageConfig.name}_desktop.png`);
      await desktopPage.screenshot({ path: desktopPath, fullPage: true });
      console.log(`Saved: ${desktopPath}`);
    } catch (err) {
      console.error(`Error capturing desktop ${pageConfig.url}:`, err);
    } finally {
      await desktopContext.close();
    }

    // 2. Tablet (1024x768)
    const tabletContext = await browser.newContext({
      viewport: { width: 1024, height: 768 }
    });
    const tabletPage = await tabletContext.newPage();
    try {
      await tabletPage.goto(pageConfig.url, { waitUntil: 'networkidle', timeout: 30000 });
      await tabletPage.waitForTimeout(2000);
      const tabletPath = path.join(artifactDir, `${pageConfig.name}_tablet_1024.png`);
      await tabletPage.screenshot({ path: tabletPath, fullPage: true });
      console.log(`Saved: ${tabletPath}`);
    } catch (err) {
      console.error(`Error capturing tablet ${pageConfig.url}:`, err);
    } finally {
      await tabletContext.close();
    }
  }

  await browser.close();
}

captureManagerScreenshots().catch(console.error);
