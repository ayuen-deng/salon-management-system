import Link from 'next/link';
import { Button } from '@/shared/views/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-50">
      <h2 className="text-4xl font-black text-slate-900 mb-2">404 - Page Not Found</h2>
      <p className="text-sm text-muted-foreground mb-6">
        The requested salon operations page could not be located.
      </p>
      <Button asChild>
        <Link href="/login">Return to Sign In</Link>
      </Button>
    </div>
  );
}
