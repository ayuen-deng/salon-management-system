import fs from 'fs';
import path from 'path';

function findMissingErrors(dir, route = '') {
  let missing = [];
  const files = fs.readdirSync(dir);
  const hasPage = files.includes('page.tsx');
  const hasError = files.includes('error.tsx');
  if (hasPage && !hasError) {
    missing.push(dir);
  }
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory() && !f.startsWith('.')) {
      missing = missing.concat(findMissingErrors(full, path.join(route, f)));
    }
  }
  return missing;
}

const template = `'use client';

import React from 'react';
import { Button } from '@/shared/views/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
      <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-[#B42318] flex items-center justify-center font-bold text-lg">
        !
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[#0A0E14]">Something went wrong</h2>
        <p className="text-xs text-[#566174] max-w-md">
          {error.message || 'An unexpected error occurred while loading this view.'}
        </p>
      </div>
      <Button
        onClick={() => reset()}
        className="bg-[#1F4FD8] hover:bg-[#1A43B8] text-white text-xs font-semibold px-4 py-2 rounded-xl"
      >
        Try again
      </Button>
    </div>
  );
}
`;

const missing = findMissingErrors('src/app');
for (const dir of missing) {
  const filePath = path.join(dir, 'error.tsx');
  fs.writeFileSync(filePath, template);
  console.log('Created:', filePath);
}
console.log('Successfully created ' + missing.length + ' error.tsx files.');
