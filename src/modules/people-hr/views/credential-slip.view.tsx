'use client';

import { useEffect, useState } from 'react';

type CredentialSlip = { fullName: string; role: string; username: string; pin: string; loginUrl: string };

export function CredentialSlipView() {
  const [credentials, setCredentials] = useState<CredentialSlip | null>(null);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.opener) return;
      if (event.data?.type === 'mzuri-credentials-slip') setCredentials(event.data.credentials as CredentialSlip);
    };
    window.addEventListener('message', receive);
    window.opener?.postMessage({ type: 'mzuri-credentials-slip-ready' }, window.location.origin);
    return () => window.removeEventListener('message', receive);
  }, []);

  if (!credentials) return <main className="p-8 text-center text-sm">Open this print slip from the one-time account credentials screen.</main>;
  return (
    <main className="mx-auto max-w-[148mm] p-8 print:max-w-none print:p-0">
      <style jsx global>{`@page { size: A5; margin: 12mm; } @media print { body { background: white !important; color: black !important; } .no-print { display: none !important; } }`}</style>
      <article className="border-2 border-black p-8 text-black print:border print:p-6">
        <p className="text-center text-xs font-bold uppercase tracking-widest">Mzuri Unisex Salon · Mbarara</p>
        <h1 className="mt-5 border-b border-black pb-3 text-center text-xl font-bold">Private sign-in credentials</h1>
        <dl className="mt-6 grid grid-cols-[110px_1fr] gap-x-4 gap-y-3 text-sm">
          <dt className="font-semibold">Name</dt><dd>{credentials.fullName}</dd>
          <dt className="font-semibold">Role</dt><dd>{credentials.role}</dd>
          <dt className="font-semibold">Username</dt><dd className="font-mono">{credentials.username}</dd>
          <dt className="font-semibold">Temporary PIN</dt><dd className="font-mono text-lg font-bold tracking-widest">{credentials.pin}</dd>
          <dt className="font-semibold">Sign-in page</dt><dd className="break-all">{credentials.loginUrl}/login</dd>
        </dl>
        <p className="mt-7 border-t border-black pt-4 text-center text-sm font-semibold">Keep this private. Choose a new PIN the first time you sign in.</p>
      </article>
      <button className="no-print mt-5 rounded-lg bg-black px-5 py-2 text-sm font-semibold text-white" onClick={() => { window.print(); setCredentials(null); }}>Print credentials slip</button>
    </main>
  );
}
