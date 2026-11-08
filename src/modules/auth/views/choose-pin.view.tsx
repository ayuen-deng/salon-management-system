'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changeTemporaryPinAction, logoutAction } from '../controllers/auth.actions';

export function ChoosePinView({ fullName }: { fullName: string }) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);
    const result = await changeTemporaryPinAction(pin, confirmation);
    if (!result.success) {
      setError(result.error.message);
      setSaving(false);
      return;
    }
    router.replace(result.data.redirectUrl);
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm space-y-5">
        <div>
          <p className="text-sm font-medium text-blue-700">Mzuri Unisex Salon</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Choose your PIN</h1>
          <p className="mt-2 text-sm text-slate-600">Welcome, {fullName}. Set a private six-digit PIN to finish signing in.</p>
        </div>
        {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium text-slate-800">
            New PIN
            <input autoComplete="new-password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} required type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg tracking-[0.35em]" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-slate-800">
            Confirm new PIN
            <input autoComplete="new-password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} required type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg tracking-[0.35em]" />
          </label>
          <p className="text-xs text-slate-500">Choose any six-digit PIN you can remember. It must be different from your temporary PIN.</p>
          <button disabled={saving} className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save PIN and continue'}</button>
        </form>
        <form action={logoutAction}>
          <button className="w-full py-2 text-sm font-medium text-slate-600 hover:text-slate-900">Sign out</button>
        </form>
      </section>
    </main>
  );
}
