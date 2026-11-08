'use client';

type CredentialSlip = { fullName: string; role: string; username: string; pin: string; loginUrl?: string };

export function openCredentialSlip(credentials: CredentialSlip): boolean {
  const popup = window.open('/print/credentials', '_blank', 'width=620,height=760');
  if (!popup) return false;
  const receiveReady = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source !== popup || event.data?.type !== 'mzuri-credentials-slip-ready') return;
    popup.postMessage({ type: 'mzuri-credentials-slip', credentials: { ...credentials, loginUrl: window.location.origin } }, window.location.origin);
    window.removeEventListener('message', receiveReady);
  };
  window.addEventListener('message', receiveReady);
  return true;
}
