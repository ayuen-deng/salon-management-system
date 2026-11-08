import { StatTileSkeleton } from '@/shared/views/ui/loading-primitives';

export default function Loading() {
  return <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6" aria-busy="true"><div className="h-8 w-40 animate-pulse rounded bg-muted" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({length:4}).map((_,index)=><StatTileSkeleton key={index}/>)}</div><div className="h-64 animate-pulse rounded-xl border border-border bg-muted/40"/><div className="h-48 animate-pulse rounded-xl border border-border bg-muted/40"/></div>;
}
