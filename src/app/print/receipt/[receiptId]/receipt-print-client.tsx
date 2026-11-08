'use client';

import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';

interface ReceiptPrintClientProps {
  autoPrint?: boolean;
}

export function ReceiptPrintClient({ autoPrint = true }: ReceiptPrintClientProps) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!autoPrint) return;

    const timer = setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        setBlocked(true);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="w-full max-w-[80mm] mb-2 print:hidden flex flex-col items-center gap-1.5">
      <button
        onClick={() => window.print()}
        className="w-full py-1.5 px-3 bg-black text-white text-xs font-bold rounded flex items-center justify-center gap-1.5 hover:bg-gray-800"
      >
        <Printer className="w-3.5 h-3.5" />
        Print Receipt
      </button>
      {blocked && (
        <p className="text-[10px] text-amber-700 bg-amber-50 p-1 rounded border border-amber-200 text-center">
          Browser blocked automatic print dialog. Please tap the button above to print.
        </p>
      )}
    </div>
  );
}
