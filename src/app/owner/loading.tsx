'use client';

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
