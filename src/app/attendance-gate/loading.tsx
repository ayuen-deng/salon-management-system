import { Loader2 } from 'lucide-react';

export default function AttendanceGateLoading() {
  return <main className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600"><span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Checking today’s attendance…</span></main>;
}
