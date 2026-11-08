import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('No SMS Scanning Audit', () => {
  const srcDir = path.resolve(__dirname, '../../..');

  function scanFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!['node_modules', '.next', '.git'].includes(file)) {
          scanFiles(fullPath, fileList);
        }
      } else if (/\.(tsx|ts)$/.test(file)) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  it('verifies customer views and desk do not contain customer-facing SMS opt-in or consent text', () => {
    const allFiles = scanFiles(srcDir);
    const violations: { file: string; match: string }[] = [];

    // Exempt dormant integration files and test files
    const exempt = ['sms.provider.ts', '.test.ts', '.test.tsx'];

    for (const file of allFiles) {
      if (exempt.some((e) => file.endsWith(e))) continue;
      const content = fs.readFileSync(file, 'utf8');

      // Check for user-facing consent or SMS opt-in strings
      if (/SMS Consent|Opted In|Send me a free SMS/i.test(content)) {
        violations.push({ file, match: 'User-facing SMS consent text found' });
      }
    }

    expect(violations).toEqual([]);
  });

  it('verifies customer repository does not accept sms_consent', () => {
    const repoFile = path.join(srcDir, 'modules/customers/models/customer.repository.ts');
    const content = fs.readFileSync(repoFile, 'utf8');
    expect(content.includes('sms_consent')).toBe(false);
  });
});
