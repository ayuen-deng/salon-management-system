import fs from 'node:fs';
import path from 'node:path';

// Rule 1: views -> controllers -> models (models never import controllers or views; controllers never import views)
// Rule 2: modules only import other modules via module root index.ts (no deep cross-module imports)
// Rule 3: Only repositories (inside models/) import the supabase client. Views and controllers never do.

const srcDir = path.resolve(process.cwd(), 'src');

let violations = [];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  const isView = normalizedPath.includes('/views/') || normalizedPath.endsWith('.view.tsx');
  const isController = normalizedPath.includes('/controllers/') || normalizedPath.endsWith('.actions.ts') || normalizedPath.endsWith('.route.ts') || normalizedPath.includes('use-');
  const isModel = normalizedPath.includes('/models/') || normalizedPath.endsWith('.repository.ts') || normalizedPath.endsWith('.service.ts') || normalizedPath.endsWith('.schema.ts');
  const isRepository = normalizedPath.endsWith('.repository.ts') || normalizedPath.includes('/repositories/');
  
  lines.forEach((line, idx) => {
    // Check Supabase import restriction
    if ((isView || isController) && (line.includes('@supabase/supabase-js') || line.includes('@/shared/lib/supabase'))) {
      violations.push(`${normalizedPath}:${idx + 1} - Architectural violation: Direct Supabase client import in View/Controller layer. Supabase client may only be imported in Repositories.`);
    }

    // Check layer dependencies
    if (isModel && (line.includes('/controllers') || line.includes('/views'))) {
      violations.push(`${normalizedPath}:${idx + 1} - Architectural violation: Model layer cannot import Controllers or Views.`);
    }

    if (isController && line.includes('/views')) {
      violations.push(`${normalizedPath}:${idx + 1} - Architectural violation: Controller layer cannot import Views.`);
    }

    // Check deep cross-module imports: e.g. import ... from '@/modules/foo/models/...'
    const deepModuleMatch = line.match(/@\/modules\/([^/'"]+)\/([^'"]+)/);
    if (deepModuleMatch) {
      const targetModule = deepModuleMatch[1];
      const targetPath = deepModuleMatch[2];
      const targetSub = targetPath.split('/')[0];
      // If importing another module beyond its public index
      const currentModuleMatch = normalizedPath.match(/\/modules\/([^/]+)\//);
      const currentModule = currentModuleMatch ? currentModuleMatch[1] : null;
      // Next.js Server Actions are explicit client/server boundaries. Importing
      // one directly avoids loading unrelated server-only barrel exports.
      const isServerAction = targetSub === 'controllers' && /\/[^/]+\.actions$/.test(targetPath);
      if (currentModule && currentModule !== targetModule && targetSub !== 'index' && !isServerAction) {
        violations.push(`${normalizedPath}:${idx + 1} - Architectural violation: Deep import from module '${targetModule}'. Must import from public index '@/modules/${targetModule}'.`);
      }
    }
  });
}

function traverse(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      traverse(fullPath);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      checkFile(fullPath);
    }
  }
}

traverse(srcDir);

if (violations.length > 0) {
  console.error('\n❌ Architectural boundary violations detected:');
  violations.forEach(v => console.error('  - ' + v));
  process.exit(1);
} else {
  console.log('✅ Architecture verification passed: Clean MVC layer boundaries and encapsulation respected.');
}
