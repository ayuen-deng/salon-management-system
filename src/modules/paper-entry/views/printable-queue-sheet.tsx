'use client';

import React from 'react';

export function QueueSheetComponent({
  salonName = 'Mzuri Unisex Salon',
  branchName = 'Mbarara',
}: {
  salonName?: string;
  branchName?: string;
}) {
  return (
    <div className="w-full h-[270mm] box-border p-6 bg-white text-black text-[9pt] leading-tight flex flex-col justify-between">
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-black pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{salonName}</h1>
          <p className="text-xs text-gray-700">{branchName} Branch • Reception Queue & Walk-in Tally Sheet</p>
        </div>
        <div className="text-right flex gap-4 text-xs">
          <div>Date: ____________________</div>
          <div>Sheet No: ________</div>
        </div>
      </div>

      <div className="text-[7.5pt] text-gray-600 italic py-1 border-b border-gray-300">
        * Payment must be collected and recorded before issuing paper code. Only paid customers enter this queue list.
      </div>

      {/* 25 Table Rows */}
      <div className="flex-1 my-2 border border-black overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 bg-gray-100 text-[8pt] font-bold border-b border-black py-1 px-2">
          <span className="col-span-1">Code</span>
          <span className="col-span-2">Time Paid</span>
          <span className="col-span-3">Customer First Name</span>
          <span className="col-span-3">Services</span>
          <span className="col-span-1">Stylist</span>
          <span className="col-span-1 text-center">Called</span>
          <span className="col-span-1 text-center">Done</span>
        </div>

        <div className="flex-1 divide-y divide-gray-200">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 h-[8.5mm] items-center px-2 text-[8.5pt]">
              <span className="col-span-1 tabular-nums font-semibold border-r border-gray-200 h-full flex items-center">
                P-{(i + 1).toString().padStart(2, '0')}
              </span>
              <span className="col-span-2 border-r border-gray-200 h-full flex items-center px-1" />
              <span className="col-span-3 border-r border-gray-200 h-full flex items-center px-1" />
              <span className="col-span-3 border-r border-gray-200 h-full flex items-center px-1" />
              <span className="col-span-1 border-r border-gray-200 h-full flex items-center px-1" />
              <span className="col-span-1 border-r border-gray-200 h-full flex items-center justify-center" />
              <span className="col-span-1 h-full flex items-center justify-center" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center text-[8pt] pt-2 border-t border-black">
        <div>Receptionist On Duty: ________________________ (Signature)</div>
        <div>Page 1 of 1 • Appendix A Operations Runbook</div>
      </div>
    </div>
  );
}
