'use client';

import { Button } from '@/shared/views/ui/button';

export default function StaffLeaveError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center"><h2 className="text-base font-semibold">Leave is temporarily unavailable</h2><p className="text-sm text-muted-foreground">Your leave information could not be loaded.</p><Button onClick={reset}>Try again</Button></div>;
}
