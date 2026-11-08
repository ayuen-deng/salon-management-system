import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const roots = ['src', 'supabase/migrations'];
const files = roots.flatMap((base) => walk(path.join(root, base))).filter((file) => /\.(ts|tsx|js|mjs|sql)$/.test(file));
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const registrations = new Map();
const used = new Set();
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.sql')) {
    for (const match of content.matchAll(/\(\s*'([A-Z][A-Z0-9_]+)'\s*,\s*'(access|people|customer|catalogue|operations|money)'\s*\)/g)) {
      const categories = registrations.get(match[1]) ?? new Set();
      categories.add(match[2]);
      registrations.set(match[1], categories);
    }
  }
  for (const match of content.matchAll(/\baction\s*:\s*['"]([A-Z][A-Z0-9_]+)['"]/g)) used.add(match[1]);
  for (const match of content.matchAll(/['"](KIOSK_[A-Z0-9_]+)['"]/g)) used.add(match[1]);
}

function audit(actions) {
  return actions.filter((action) => !registrations.has(action));
}
function findConflicts(registry) {
  return [...registry]
    .filter(([, categories]) => categories.size > 1)
    .map(([action, categories]) => `${action} (${[...categories].join(', ')})`);
}

const missing = audit([...used].sort());
const conflicts = findConflicts(registrations);
if (process.argv.includes('--self-test')) {
  const deliberateBadAction = 'DELIBERATE_UNREGISTERED_AUDIT_ACTION';
  if (audit([deliberateBadAction]).length !== 1) {
    console.error('Self-test failed: unregistered action was not rejected.');
    process.exit(1);
  }
  console.log(`Self-test passed: ${deliberateBadAction} is rejected.`);
  const deliberateConflict = new Map([['DELIBERATE_CONFLICT', new Set(['operations', 'money'])]]);
  if (findConflicts(deliberateConflict).length !== 1) {
    console.error('Self-test failed: conflicting categories were not detected.');
    process.exit(1);
  }
  console.log('Self-test passed: duplicate category mappings are rejected.');
}
if (conflicts.length) {
  console.error(`Audit actions mapped to multiple categories: ${conflicts.join('; ')}`);
  process.exit(1);
}
if (missing.length) {
  console.error(`Unregistered audit actions: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`Audit registry check passed (${used.size} actions checked).`);
