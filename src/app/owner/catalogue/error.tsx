'use client';

import { Button } from '@/shared/views/ui/button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 space-y-4 text-center">
      <h2 className="text-sm font-bold text-slate-900">Failed to load catalogue</h2>
      <p className="text-xs text-muted-foreground">{error.message}</p>
      <Button size="sm" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
