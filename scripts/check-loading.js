const fs = require('fs');
const path = require('path');

function getAppPages(dir = 'src/app') {
  let results = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory()) {
      results = results.concat(getAppPages(full));
    } else if (item === 'page.tsx') {
      const parentDir = path.dirname(full);
      const hasLoading = fs.existsSync(path.join(parentDir, 'loading.tsx'));
      const hasError = fs.existsSync(path.join(parentDir, 'error.tsx'));
      results.push({ page: full, hasLoading, hasError, route: parentDir });
    }
  }
  return results;
}

const pages = getAppPages();
const missingLoading = pages.filter(p => !p.hasLoading);
const missingError = pages.filter(p => !p.hasError);

let hasFailure = false;

if (missingLoading.length > 0) {
  console.error(`Check loading FAILED: ${missingLoading.length} routes missing loading.tsx:`);
  missingLoading.forEach(p => console.error('  -', p.page));
  hasFailure = true;
}

if (hasFailure) {
  process.exit(1);
} else {
  console.log(`✅ All ${pages.length} routes have valid loading.tsx files. Skeletons enforced.`);
  process.exit(0);
}
