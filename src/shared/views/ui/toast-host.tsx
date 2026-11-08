'use client';

import { useEffect, useState } from 'react';
import type { ToastRequest } from '@/shared/lib/toast';

type DialogRequest = { kind: 'confirm' | 'prompt'; message: string; resolve: (value: boolean | string | null) => void };

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastRequest[]>([]);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    const onToast = (event: Event) => {
      const toast = (event as CustomEvent<ToastRequest>).detail;
      setToasts((items) => [...items, toast]);
      window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== toast.id)), 4500);
    };
    const onDialog = (event: Event) => {
      const request = (event as CustomEvent<DialogRequest>).detail;
      setPromptValue('');
      setDialog(request);
    };
    window.addEventListener('mzuri:toast', onToast);
    window.addEventListener('mzuri:dialog', onDialog);
    return () => { window.removeEventListener('mzuri:toast', onToast); window.removeEventListener('mzuri:dialog', onDialog); };
  }, []);

  const finish = (value: boolean | string | null) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  return <>
    <div className="fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => <div key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' : toast.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-900'}`}><span>{toast.message}</span>{toast.action && <button type="button" onClick={toast.action.onClick} className="shrink-0 font-semibold text-blue-700 underline underline-offset-2">{toast.action.label}</button>}</div>)}
    </div>
    {dialog && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="mzuri-dialog-message" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <p id="mzuri-dialog-message" className="text-sm font-medium text-slate-900">{dialog.message}</p>
        {dialog.kind === 'prompt' && <input autoFocus value={promptValue} onChange={(event) => setPromptValue(event.target.value)} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => finish(dialog.kind === 'confirm' ? false : null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={() => finish(dialog.kind === 'confirm' ? true : promptValue)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">{dialog.kind === 'confirm' ? 'Confirm' : 'Submit'}</button>
        </div>
      </section>
    </div>}
  </>;
}
