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
let totalReplaced = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // 1. Remove font-serif
  content = content.replace(/\bfont-serif\b/g, '');

  // 2. Remove tracking-widest / tracking-wider
  content = content.replace(/\btracking-widest\b/g, 'tracking-normal');
  content = content.replace(/\btracking-wider\b/g, 'tracking-normal');

  // 3. Replace font-mono with tabular-nums
  content = content.replace(/\bfont-mono\b/g, 'tabular-nums');

  // 4. Remove uppercase class
  content = content.replace(/\buppercase\b/g, '');

  // 5. Replace bronze and orange hexes
  content = content.replace(/#F26A21/gi, '#1F4FD8');
  content = content.replace(/#D65914/gi, '#1A43B8');
  content = content.replace(/#9A7B4F/gi, '#1F4FD8');
  content = content.replace(/#8F6F41/gi, '#1A43B8');
  content = content.replace(/#9A6B2F/gi, '#1F4FD8');
  content = content.replace(/#C5A880/gi, '#EEF3FF');
  content = content.replace(/#F7F5F0/gi, '#F6F8FB');
  content = content.replace(/#E8E2D9/gi, '#E2E7EF');
  content = content.replace(/#3D3428/gi, '#111827');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    totalReplaced++;
  }
}

console.log('Modified files:', totalReplaced);
