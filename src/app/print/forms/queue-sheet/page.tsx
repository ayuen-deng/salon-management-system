import React from 'react';
import { QueueSheetComponent } from '@/modules/paper-entry';

export const metadata = {
  title: 'Reception Queue Sheet (A4 Print) | Mzuri Unisex Salon',
};

export default function PrintableQueueSheetPage() {
  return (
    <div className="print-clean bg-white text-black p-0 m-0">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm 12mm;
        }
        @media print {
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="w-[186mm] h-[277mm] mx-auto box-border">
        <QueueSheetComponent />
      </div>
    </div>
  );
}
