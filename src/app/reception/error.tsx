'use client';

import React from 'react';
import { Button } from '@/shared/views/ui/button';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 max-w-lg mx-auto text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">Reception Desk Error</h2>
      <p className="text-sm text-slate-600">
        {error.message || 'An unexpected operational error occurred while loading this view.'}
      </p>
      <Button onClick={() => reset()} className="gap-2">
        <RotateCcw className="w-4 h-4" /> Try Again
      </Button>
    </div>
  );
}
