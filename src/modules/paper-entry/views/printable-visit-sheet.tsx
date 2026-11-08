'use client';

import React from 'react';

export function VisitSheetComponent({
  serial,
  salonName = 'Mzuri Unisex Salon',
  branchName = 'Mbarara',
}: {
  serial: string;
  salonName?: string;
  branchName?: string;
}) {
  return (
    <div className="w-full h-[138mm] box-border p-4 bg-white text-black text-[9.5pt] leading-tight flex flex-col justify-between border-b-2 border-dashed border-gray-400 last:border-b-0">
      {/* 1. Header Row */}
      <div className="flex justify-between items-start border-b border-black pb-1.5">
        <div>
          <div className="font-bold text-sm tracking-tight">{salonName}</div>
          <div className="text-[8pt] text-gray-700">{branchName} Branch • Customer Visit Sheet</div>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-[7.5pt] font-semibold block text-gray-600">SERIAL NUMBER</span>
            <span className="font-bold text-sm tracking-wider tabular-nums">{serial}</span>
          </div>
          <div className="border-l border-gray-300 pl-3">
            <span className="text-[7.5pt] font-semibold block text-gray-600">PAPER TICKET</span>
            <span className="font-bold text-base">P-____</span>
          </div>
        </div>
      </div>

      {/* 2. Metadata Strip */}
      <div className="grid grid-cols-4 gap-2 py-1 border-b border-gray-300 text-[8.5pt]">
        <div>
          <span className="text-gray-600">Date:</span> ________________
        </div>
        <div>
          <span className="text-gray-600">Time Arrived:</span> ____:____
        </div>
        <div className="col-span-2 flex items-center justify-end gap-3">
          <label className="flex items-center gap-1">
            <span className="w-3.5 h-3.5 border border-black inline-block" /> Booked Appt?
          </label>
          <span>Time: ____:____</span>
        </div>
      </div>

      {/* 3. Customer Block */}
      <div className="grid grid-cols-12 gap-2 py-1.5 border-b border-gray-300">
        <div className="col-span-6 flex items-center gap-1">
          <span className="font-semibold text-gray-700 shrink-0">Customer First Name:</span>
          <div className="flex-1 border-b border-black h-4" />
        </div>
        <div className="col-span-4 flex items-center gap-1">
          <span className="font-semibold text-gray-700 shrink-0">Phone:</span>
          <div className="flex-1 border-b border-black h-4" />
        </div>
        <div className="col-span-2 flex items-center gap-1 text-[8pt]">
          <span className="w-3 h-3 border border-black inline-block shrink-0" />
          <span>Read-back OK</span>
        </div>
      </div>

      {/* 4. Services Table (5 rows, min 9mm line height) */}
      <div className="space-y-0.5 my-1">
        <div className="grid grid-cols-12 text-[7.5pt] font-bold text-gray-700 pb-0.5 border-b border-black">
          <span className="col-span-5">Service & Variant Performed</span>
          <span className="col-span-2 text-right">List UGX</span>
          <span className="col-span-3 pl-2">Stylist</span>
          <span className="col-span-2 text-center">Req?</span>
        </div>
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="grid grid-cols-12 h-[8.5mm] border-b border-gray-200 items-center text-[9pt]">
            <div className="col-span-5 pr-1 border-r border-gray-200 h-full flex items-center" />
            <div className="col-span-2 pr-1 border-r border-gray-200 h-full flex items-center justify-end" />
            <div className="col-span-3 px-1 border-r border-gray-200 h-full flex items-center" />
            <div className="col-span-2 h-full flex items-center justify-center">
              <span className="w-3 h-3 border border-gray-400 inline-block" />
            </div>
          </div>
        ))}
      </div>

      {/* 5. Totals & Discounts Strip */}
      <div className="grid grid-cols-12 gap-2 py-1 border-t border-b border-black text-[8pt] bg-gray-50/50">
        <div className="col-span-3">
          <span className="text-gray-600 block text-[7pt]">SUBTOTAL</span>
          <span className="font-semibold">UGX _______________</span>
        </div>
        <div className="col-span-3">
          <span className="text-gray-600 block text-[7pt]">DISCOUNT (REASON)</span>
          <span>- __________________</span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-600 block text-[7pt]">MGR INITIALS</span>
          <span>[ ____ ]</span>
        </div>
        <div className="col-span-4 text-right">
          <span className="text-gray-600 block text-[7pt]">TOTAL TO PAY (TAKEN FIRST)</span>
          <span className="font-bold text-[10pt]">UGX __________________</span>
        </div>
      </div>

      {/* 6. Payment Block (Payment Taken Before Service) */}
      <div className="py-1 border-b border-gray-300">
        <div className="text-[7.5pt] font-bold text-gray-700 mb-0.5">
          Payment Confirmation (Taken Prior to Queue/Service Entry)
        </div>
        <div className="grid grid-cols-12 gap-2 text-[8.5pt] items-center">
          <div className="col-span-4 flex items-center gap-3">
            <label className="flex items-center gap-1 font-semibold">
              <span className="w-3.5 h-3.5 border border-black inline-block" /> Cash
            </label>
            <label className="flex items-center gap-1 font-semibold">
              <span className="w-3.5 h-3.5 border border-black inline-block" /> Mobile Money
            </label>
          </div>
          <div className="col-span-4 flex items-center gap-1">
            <span className="text-gray-600 text-[8pt]">MoMo Ref:</span>
            <div className="flex-1 border-b border-black h-3.5" />
          </div>
          <div className="col-span-4 flex items-center justify-end gap-2 text-[8pt]">
            <span>Time: ____:____</span>
            <span>Recvd By: [ _____ ]</span>
          </div>
        </div>
      </div>

      {/* 7. Service Times (Reported by Staff to Reception) */}
      <div className="grid grid-cols-12 gap-2 py-1 border-b border-gray-300 text-[8pt]">
        <div className="col-span-5 font-semibold text-gray-700">
          Service Times (Staff reported to Reception):
        </div>
        <div className="col-span-3">
          Start Time: <strong>____ : ____</strong>
        </div>
        <div className="col-span-2">
          End: <strong>____ : ____</strong>
        </div>
        <div className="col-span-2 text-right">
          Staff: ____________
        </div>
      </div>

      {/* 8. Audit Footer */}
      <div className="flex justify-between items-center text-[7.5pt] text-gray-600 pt-0.5">
        <div>Entered in digital system by: ________________________ on ____/____/2026 at ____:____</div>
        <div>Appendix A Compliance • Paper Fallback Sheet</div>
      </div>
    </div>
  );
}
