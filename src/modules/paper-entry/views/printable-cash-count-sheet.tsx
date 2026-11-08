'use client';

import React from 'react';

export function CashCountSheetComponent({
  salonName = 'Mzuri Unisex Salon',
  branchName = 'Mbarara',
}: {
  salonName?: string;
  branchName?: string;
}) {
  const notes = [
    { label: '50,000 UGX Note', val: 50000 },
    { label: '20,000 UGX Note', val: 20000 },
    { label: '10,000 UGX Note', val: 10000 },
    { label: '5,000 UGX Note', val: 5000 },
    { label: '2,000 UGX Note', val: 2000 },
    { label: '1,000 UGX Note', val: 1000 },
  ];

  const coins = [
    { label: '500 UGX Coin', val: 500 },
    { label: '200 UGX Coin', val: 200 },
    { label: '100 UGX Coin', val: 100 },
    { label: '50 UGX Coin', val: 50 },
  ];

  return (
    <div className="w-full h-[270mm] box-border p-6 bg-white text-black text-[9pt] leading-tight flex flex-col justify-between">
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-black pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{salonName}</h1>
          <p className="text-xs text-gray-700">{branchName} Branch • Cash Drawer Handover &amp; Shift Close Counting Sheet</p>
        </div>
        <div className="text-right text-xs">
          <div>Date: ____________________</div>
          <div>Opening Float: <strong>UGX 50,000</strong></div>
        </div>
      </div>

      <div className="my-2 border border-black">
        <div className="grid grid-cols-12 bg-gray-100 font-bold border-b border-black py-1.5 px-3 text-[8pt]">
          <span className="col-span-6">Denomination (Uganda Shillings)</span>
          <span className="col-span-3 text-center">Physical Count (Pieces)</span>
          <span className="col-span-3 text-right">Line Total (UGX)</span>
        </div>

        {/* Banknotes */}
        <div className="bg-gray-50/50 px-3 py-1 font-bold text-[8pt] border-b border-gray-300">
          Banknotes
        </div>
        {notes.map((n, i) => (
          <div key={i} className="grid grid-cols-12 h-[8.5mm] border-b border-gray-200 items-center px-3 text-[9pt]">
            <span className="col-span-6 font-semibold border-r border-gray-200 h-full flex items-center">{n.label}</span>
            <span className="col-span-3 border-r border-gray-200 h-full flex items-center justify-center tabular-nums" />
            <span className="col-span-3 h-full flex items-center justify-end tabular-nums pr-2" />
          </div>
        ))}

        {/* Coins */}
        <div className="bg-gray-50/50 px-3 py-1 font-bold text-[8pt] border-b border-gray-300">
          Coins
        </div>
        {coins.map((c, i) => (
          <div key={i} className="grid grid-cols-12 h-[8mm] border-b border-gray-200 last:border-b-0 items-center px-3 text-[9pt]">
            <span className="col-span-6 font-semibold border-r border-gray-200 h-full flex items-center">{c.label}</span>
            <span className="col-span-3 border-r border-gray-200 h-full flex items-center justify-center tabular-nums" />
            <span className="col-span-3 h-full flex items-center justify-end tabular-nums pr-2" />
          </div>
        ))}
      </div>

      {/* Reconciliation Section */}
      <div className="border border-black p-3 space-y-2 bg-gray-50/30">
        <div className="font-bold text-[9pt]">Drawer Reconciliation Summary</div>
        <div className="grid grid-cols-2 gap-4 text-[9pt]">
          <div className="space-y-1.5">
            <div className="flex justify-between border-b border-gray-300 pb-0.5">
              <span>A. Total Physical Cash Counted:</span>
              <span className="font-bold">UGX _________________</span>
            </div>
            <div className="flex justify-between border-b border-gray-300 pb-0.5">
              <span>B. Less Opening Float:</span>
              <span>- UGX 50,000</span>
            </div>
            <div className="flex justify-between font-bold pt-1">
              <span>C. Net Salon Cash Collected (A - B):</span>
              <span>UGX _________________</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between border-b border-gray-300 pb-0.5">
              <span>D. Cash Expected from Visit Sheets:</span>
              <span className="font-bold">UGX _________________</span>
            </div>
            <div className="flex justify-between border-b border-gray-300 pb-0.5">
              <span>E. Variance / Difference (C - D):</span>
              <span className="font-bold">[ Over / Short ] UGX ___________</span>
            </div>
            <div className="text-[7.5pt] text-gray-500 pt-0.5">
              * Any variance over UGX 5,000 requires manager written audit log incident report.
            </div>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-6 pt-3 border-t-2 border-black text-[8.5pt]">
        <div>
          <div>Counted By (Receptionist): _______________________________</div>
          <div className="mt-1">Name: Mary Namubiru • Time: ____:____</div>
        </div>
        <div>
          <div>Countersigned By (Manager): _______________________________</div>
          <div className="mt-1">Name: Joan Tumusiime • Shift Close Confirmation</div>
        </div>
      </div>
    </div>
  );
}
