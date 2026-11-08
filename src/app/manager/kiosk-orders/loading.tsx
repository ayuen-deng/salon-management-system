'use client';

import { TableSkeleton } from '@/shared/views/ui/loading-primitives';

export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" aria-busy="true" aria-label="Loading kiosk orders">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-12 w-full animate-pulse rounded-lg bg-slate-200" />
      <TableSkeleton rows={6} />
    </main>
  );
}
