import fs from 'fs';
import path from 'path';

function getAllFiles(dir, exts = ['.tsx', '.ts', '.css']) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.next') {
        files = files.concat(getAllFiles(fullPath, exts));
      }
    } else if (exts.includes(path.extname(fullPath))) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getAllFiles('src');
const errors = [];

const FORBIDDEN_CLASSES = [
  /\bfont-mono\b/,
  /\bfont-serif\b/,
  /\buppercase\b/,
  /\btracking-widest\b/
];

const FORBIDDEN_COLORS = [
  /#9A7B4F/i,
  /#8F6F41/i,
  /#C5A880/i,
  /#F26A21/i,
  /#D65914/i,
  /#9A6B2F/i,
  /#3D3428/i,
  /#E8E2D9/i,
  /#F7F5F0/i
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');

  for (const regex of FORBIDDEN_CLASSES) {
    if (regex.test(content)) {
      errors.push(`[FORBIDDEN CLASS] ${file} contains pattern: ${regex}`);
    }
  }

  for (const regex of FORBIDDEN_COLORS) {
    if (regex.test(content)) {
      errors.push(`[FORBIDDEN COLOR] ${file} contains pattern: ${regex}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Design token check FAILED with ${errors.length} errors:`);
  errors.forEach(e => console.error(' - ' + e));
  process.exit(1);
} else {
  console.log(`Design token check PASSED! Scanned ${files.length} files. Zero forbidden tokens found.`);
  process.exit(0);
}
