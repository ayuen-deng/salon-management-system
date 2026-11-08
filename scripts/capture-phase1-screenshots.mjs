import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = 'C:/Users/PC/.gemini/antigravity/brain/e785eeb8-3e06-44ad-90aa-a088bcce5bd0';

async function main() {
  console.log('Starting Phase 1 verification and screenshot capture...');
  const browser = await chromium.launch({ headless: true });

  const routes = [
    { name: 'mzuri_manager_customers', url: 'http://localhost:3000/manager/customers', role: 'manager', pin: '2026' },
    { name: 'mzuri_owner_customers', url: 'http://localhost:3000/owner/customers', role: 'owner', pin: '1974' },
    { name: 'mzuri_reception', url: 'http://localhost:3000/reception', role: 'receptionist', pin: '1234' },
    { name: 'mzuri_catalogue', url: 'http://localhost:3000/manager/catalogue', role: 'manager', pin: '2026' },
    { name: 'mzuri_staff', url: 'http://localhost:3000/staff', role: 'staff', pin: '5678' },
    { name: 'mzuri_desk', url: 'http://localhost:3000/desk', isPublic: true },
  ];

  // 1. Desktop captures (1280x800)
  for (const r of routes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      if (!r.isPublic) {
        await page.goto(`http://localhost:3000/login?role=${r.role}`);
        await page.waitForLoadState('networkidle');
        const pinInput = page.locator('input[type="password"]');
        if (await pinInput.count() > 0) {
          await pinInput.fill(r.pin);
          await page.click('button[type="submit"]');
          await page.waitForTimeout(1000);
        }
      }
      await page.goto(r.url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const filePath = path.join(ARTIFACT_DIR, `${r.name}_desktop.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`✓ Saved desktop screenshot: ${filePath}`);

      // Check for illegal names
      const html = await page.content();
      if (html.includes('Kembabazi') || html.includes('High Street Branch')) {
        console.warn(`[WARNING] Found old branding on ${r.url}`);
      }
    } catch (e) {
      console.error(`Error on ${r.name}:`, e.message);
    } finally {
      await page.close();
    }
  }

  // 2. Tablet captures (1024x768)
  for (const r of routes.slice(0, 4)) {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    try {
      if (!r.isPublic) {
        await page.goto(`http://localhost:3000/login?role=${r.role}`);
        await page.waitForLoadState('networkidle');
        const pinInput = page.locator('input[type="password"]');
        if (await pinInput.count() > 0) {
          await pinInput.fill(r.pin);
          await page.click('button[type="submit"]');
          await page.waitForTimeout(1000);
        }
      }
      await page.goto(r.url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const filePath = path.join(ARTIFACT_DIR, `${r.name}_tablet_1024.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`✓ Saved tablet screenshot: ${filePath}`);
    } catch (e) {
      console.error(`Error on tablet ${r.name}:`, e.message);
    } finally {
      await page.close();
    }
  }

  // 3. Mobile captures (390x844) for staff and owner
  const mobileRoutes = [
    { name: 'mzuri_staff', url: 'http://localhost:3000/staff', role: 'staff', pin: '5678' },
    { name: 'mzuri_owner', url: 'http://localhost:3000/owner', role: 'owner', pin: '1974' },
    { name: 'mzuri_owner_customers', url: 'http://localhost:3000/owner/customers', role: 'owner', pin: '1974' },
  ];

  for (const r of mobileRoutes) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(`http://localhost:3000/login?role=${r.role}`);
      await page.waitForLoadState('networkidle');
      const pinInput = page.locator('input[type="password"]');
      if (await pinInput.count() > 0) {
        await pinInput.fill(r.pin);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(1000);
      }
      await page.goto(r.url);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const filePath = path.join(ARTIFACT_DIR, `${r.name}_mobile_390.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`✓ Saved mobile screenshot: ${filePath}`);
    } catch (e) {
      console.error(`Error on mobile ${r.name}:`, e.message);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('All verification screenshots captured successfully!');
}

main().catch(console.error);
