'use client';

import React from 'react';
import { Button } from '@/shared/views/ui/button';

export default function VisitsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-7xl mx-auto p-6 text-center space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">Failed to load visits</h2>
      <p className="text-xs text-slate-500">{error.message || 'An unexpected error occurred.'}</p>
      <Button onClick={() => reset()} className="bg-[#1F4FD8] hover:bg-[#1A43B8] text-white">
        Try again
      </Button>
    </div>
  );
}
