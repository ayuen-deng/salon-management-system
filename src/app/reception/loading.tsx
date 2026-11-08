export function ReceptionLoadingSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-8 bg-slate-200 rounded-lg w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="h-48 bg-slate-100 rounded-2xl border border-slate-200" />
        <div className="h-48 bg-slate-100 rounded-2xl border border-slate-200" />
        <div className="h-48 bg-slate-100 rounded-2xl border border-slate-200" />
      </div>
      <div className="h-96 bg-slate-100 rounded-2xl border border-slate-200" />
    </div>
  );
}

export default function Loading() {
  return <ReceptionLoadingSkeleton />;
}
