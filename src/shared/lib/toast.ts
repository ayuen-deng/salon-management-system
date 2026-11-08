'use client';

export type ToastKind = 'success' | 'error' | 'info';
export type ToastAction = { label: string; onClick: () => void };
export type ToastRequest = { id: number; message: string; kind: ToastKind; action?: ToastAction };
type DialogRequest = { kind: 'confirm' | 'prompt'; message: string; resolve: (value: boolean | string | null) => void };

let nextId = 0;
export function showToast(message: string, kind: ToastKind = 'info', action?: ToastAction) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mzuri:toast', { detail: { id: ++nextId, message, kind, action } }));
}

function requestDialog(kind: DialogRequest['kind'], message: string): Promise<boolean | string | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(kind === 'confirm' ? false : null);
    window.dispatchEvent(new CustomEvent('mzuri:dialog', { detail: { kind, message, resolve } }));
  });
}

export async function showConfirm(message: string) { return (await requestDialog('confirm', message)) === true; }
export async function showPrompt(message: string) { return requestDialog('prompt', message) as Promise<string | null>; }
