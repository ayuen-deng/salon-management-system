'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6 max-w-lg mx-auto text-center space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
      <p className="text-xs text-rose-600 tabular-nums">{error.message}</p>
      <button onClick={() => reset()} className="px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold">
        Try again
      </button>
    </div>
  );
}
