'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { pairKioskDeviceAction } from '../controllers/kiosk-order.actions';

function PreparingTablet() {
  return (
    <div className="min-h-screen bg-[#F6F5F2] p-6 font-sans text-[#1F2328]" aria-busy="true" data-loading="true">
      <header className="mx-auto flex max-w-5xl items-center justify-between border-b border-[#E4E1DA] bg-white px-6 py-5">
        <h1 className="text-xl font-bold tracking-tight">Mzuri Unisex Salon</h1>
        <span className="text-sm text-slate-600">Mbarara</span>
      </header>
      <section className="mx-auto mt-10 max-w-5xl rounded-3xl border border-[#CBD5E1] bg-white p-6 shadow-sm sm:p-8" aria-label="Preparing kiosk">
        <h2 className="text-2xl font-bold">Preparing this tablet</h2>
        <p className="mt-2 text-sm text-slate-600">Checking tablet pairing…</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2" aria-hidden="true">
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </section>
    </div>
  );
}

const PairedDeskTabletView = dynamic(
  () => import('./desk-tablet.view').then((module) => module.DeskTabletView),
  { loading: () => <PreparingTablet /> },
);

export function DeskTabletEntryView() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState('');

  useEffect(() => {
    setHasSession(Boolean(window.localStorage.getItem('mzuri-kiosk-device-session')));
    setCheckingSession(false);
  }, []);

  async function handlePairTablet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPairingError('');
    setPairingLoading(true);
    try {
      const result = await pairKioskDeviceAction(pairingCode);
      if (!result.success) {
        setPairingError(result.error.message);
        return;
      }
      window.localStorage.setItem('mzuri-kiosk-device-session', result.data.sessionToken);
      setHasSession(true);
    } catch {
      setPairingError('Could not pair this tablet. Check the connection and try again.');
    } finally {
      setPairingLoading(false);
    }
  }

  if (checkingSession) return <PreparingTablet />;
  if (hasSession) return <PairedDeskTabletView />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F5F2] p-6 font-sans text-[#1F2328]">
      <form onSubmit={handlePairTablet} className="w-full max-w-md rounded-3xl border border-[#CBD5E1] bg-white p-8 shadow-sm space-y-5">
        <div>
          <p className="text-sm font-semibold text-[#1F4FD8]">Mzuri Unisex Salon</p>
          <h1 className="mt-2 text-2xl font-bold">Pair this tablet</h1>
          <p className="mt-2 text-sm text-slate-600">Enter the six-digit pairing code provided by the manager.</p>
        </div>
        {pairingError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{pairingError}</p>}
        <label className="block text-sm font-semibold">
          Pairing code
          <input
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={pairingCode}
            onChange={(event) => setPairingCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.3em]"
          />
        </label>
        <button disabled={pairingLoading || pairingCode.length !== 6} className="w-full rounded-xl bg-[#1F4FD8] px-4 py-3 font-bold text-white disabled:opacity-50">
          {pairingLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Pairing…</span> : 'Pair tablet'}
        </button>
      </form>
    </div>
  );
}
