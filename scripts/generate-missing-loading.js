const fs = require('fs');
const path = require('path');

const missingLoadingDirs = [
  'src/app/(auth)/login',
  'src/app/desk',
  'src/app/display/queue',
  'src/app/hr',
  'src/app/manager',
  'src/app/owner',
  'src/app/owner/audit',
  'src/app/owner/customers',
  'src/app/owner/payments',
  'src/app/owner/settings',
  'src/app/owner/staff',
  'src/app/owner/summaries',
  'src/app/owner/visits',
  'src/app/owner/waits',
  'src/app',
  'src/app/print',
  'src/app/staff',
  'src/app/staff/appointments',
  'src/app/staff/history',
  'src/app/staff/target'
];

for (const dir of missingLoadingDirs) {
  const loadingFile = path.join(dir, 'loading.tsx');
  if (!fs.existsSync(loadingFile)) {
    const content = `'use client';

import React from 'react';
import { StatTileSkeleton, TableSkeleton } from '@/shared/views/ui/loading-primitives';

export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto animate-pulse" aria-busy="true">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
      </div>
      <TableSkeleton rows={4} />
    </div>
  );
}
`;
    fs.writeFileSync(loadingFile, content, 'utf8');
    console.log('Created:', loadingFile);
  }
}
