import React, { Suspense } from 'react';
import { VisitSheetComponent } from '@/modules/paper-entry';

export const metadata = {
  title: 'Customer Visit Sheet (A4 Print) | Mzuri Unisex Salon',
};

function VisitSheetContent({
  searchParams,
}: {
  searchParams: Promise<{ count?: string; start?: string }>;
}) {
  return (
    <VisitSheetRenderer searchParams={searchParams} />
  );
}

async function VisitSheetRenderer({
  searchParams,
}: {
  searchParams: Promise<{ count?: string; start?: string }>;
}) {
  const params = await searchParams;
  const count = Math.max(1, parseInt(params.count || '2', 10));
  const startNum = parseInt(params.start || '1', 10);

  // Generate consecutive serials: R-0001, R-0002...
  const sheets = Array.from({ length: count }).map((_, i) => {
    const num = startNum + i;
    return `R-${num.toString().padStart(4, '0')}`;
  });

  // 2 sheets per A4 page
  const pages: string[][] = [];
  for (let i = 0; i < sheets.length; i += 2) {
    pages.push([sheets[i], sheets[i + 1] || '']);
  }

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
          .page-break {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>

      {pages.map((pair, pIdx) => (
        <div key={pIdx} className="w-[186mm] h-[277mm] mx-auto box-border flex flex-col justify-between page-break">
          <VisitSheetComponent serial={pair[0]} />
          {pair[1] ? (
            <VisitSheetComponent serial={pair[1]} />
          ) : (
            <div className="w-full h-[138mm] box-border p-4 bg-white border-t-2 border-dashed border-gray-400 flex items-center justify-center text-gray-300 text-xs">
              [ Blank half sheet ]
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PrintableVisitSheetPage(props: {
  searchParams: Promise<{ count?: string; start?: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-8 text-xs font-medium">Loading printable visit sheet...</div>}>
      <VisitSheetContent searchParams={props.searchParams} />
    </Suspense>
  );
}
