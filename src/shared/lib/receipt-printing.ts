'use client';

export interface PrintReceiptOptions {
  duplicate?: boolean;
  reprintedAt?: string;
}

/** Loads the dedicated print route in a hidden frame and prints only its receipt. */
export async function printReceipt(receiptId: string, options: PrintReceiptOptions = {}): Promise<void> {
  if (typeof window === 'undefined' || !receiptId) return;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.title = 'Receipt print frame';
  Object.assign(frame.style, {
    position: 'fixed',
    width: '1px',
    height: '1px',
    left: '-10000px',
    top: '0',
    border: '0',
  });

  const params = new URLSearchParams({ auto: 'false' });
  if (options.duplicate) params.set('duplicate', 'true');
  if (options.reprintedAt) params.set('reprintedAt', options.reprintedAt);
  frame.src = `/print/receipt/${encodeURIComponent(receiptId)}?${params.toString()}`;
  document.body.appendChild(frame);

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('The receipt print page did not load in time.'));
    }, 30_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      frame.removeEventListener('load', onLoad);
      frame.removeEventListener('error', onError);
    };
    const onError = () => {
      cleanup();
      frame.remove();
      reject(new Error('The receipt print page could not be loaded.'));
    };
    const onLoad = () => {
      cleanup();
      const printWindow = frame.contentWindow;
      if (!printWindow) {
        frame.remove();
        reject(new Error('The receipt print frame is unavailable.'));
        return;
      }

      const removeFrame = () => window.setTimeout(() => frame.remove(), 250);
      printWindow.addEventListener('afterprint', removeFrame, { once: true });
      window.setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
          // Some browsers do not emit afterprint for a hidden frame.
          window.setTimeout(removeFrame, 60_000);
          resolve();
        } catch (error) {
          frame.remove();
          reject(error);
        }
      }, 150);
    };

    frame.addEventListener('load', onLoad, { once: true });
    frame.addEventListener('error', onError, { once: true });
  });
}
