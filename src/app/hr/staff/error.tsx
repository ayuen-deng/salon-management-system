'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8 text-center space-y-3">
      <div className="text-sm font-semibold text-rose-600">Failed to load staff directory</div>
      <p className="text-xs text-muted-foreground">{error.message}</p>
      <button
        onClick={() => reset()}
        className="px-3 py-1.5 text-xs bg-[#1F4FD8] text-white rounded-lg font-medium"
      >
        Try again
      </button>
    </div>
  );
}
