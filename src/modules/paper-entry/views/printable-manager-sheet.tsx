'use client';

import React from 'react';

export function ManagerDaySheetComponent({
  salonName = 'Mzuri Unisex Salon',
  branchName = 'Mbarara',
}: {
  salonName?: string;
  branchName?: string;
}) {
  return (
    <div className="w-full h-[270mm] box-border p-6 bg-white text-black text-[8.5pt] leading-tight flex flex-col justify-between">
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-black pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{salonName}</h1>
          <p className="text-xs text-gray-700">{branchName} Branch • Manager&apos;s Daily Operational Summary Sheet</p>
        </div>
        <div className="text-right text-xs">
          <div>Date: ____________________</div>
          <div>Manager: Joan Tumusiime</div>
        </div>
      </div>

      {/* 1. Staff Attendance Roster Table */}
      <div className="space-y-1">
        <h3 className="font-bold text-[9pt] tracking-normal text-gray-800">1. Staff Attendance & Floor Coverage</h3>
        <div className="border border-black">
          <div className="grid grid-cols-12 bg-gray-100 font-bold border-b border-black py-1 px-2 text-[7.5pt]">
            <span className="col-span-4">Staff Member</span>
            <span className="col-span-2 text-center">Clock In</span>
            <span className="col-span-2 text-center">Clock Out</span>
            <span className="col-span-2 text-center">Breaks Logged</span>
            <span className="col-span-2 text-center">Late Status</span>
          </div>
          {['Grace Atuhaire (Stylist)', 'Sarah Kobusingye (Stylist)', 'Peter Byamukama (Barber)', 'Rose Kyomugisha (Stylist)', 'Mary Namubiru (Reception)', 'David Kato (HR)', 'Joan Tumusiime (Manager)'].map((st, i) => (
            <div key={i} className="grid grid-cols-12 h-[7mm] border-b border-gray-200 last:border-b-0 items-center px-2 text-[8pt]">
              <span className="col-span-4 font-semibold border-r border-gray-200 h-full flex items-center">{st}</span>
              <span className="col-span-2 border-r border-gray-200 h-full flex items-center justify-center">____:____</span>
              <span className="col-span-2 border-r border-gray-200 h-full flex items-center justify-center">____:____</span>
              <span className="col-span-2 border-r border-gray-200 h-full flex items-center justify-center" />
              <span className="col-span-2 h-full flex items-center justify-center">
                <span className="w-3 h-3 border border-gray-400 inline-block mr-1" /> Late
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Exceptions Log */}
      <div className="space-y-1">
        <h3 className="font-bold text-[9pt] tracking-normal text-gray-800">2. Log of Exceptions (Voids, Refunds, Discounts &gt;UGX 5k, Comps)</h3>
        <div className="border border-black">
          <div className="grid grid-cols-12 bg-gray-100 font-bold border-b border-black py-1 px-2 text-[7.5pt]">
            <span className="col-span-1">Time</span>
            <span className="col-span-2">Ticket/Serial</span>
            <span className="col-span-3">Exception Type</span>
            <span className="col-span-2 text-right">Amount UGX</span>
            <span className="col-span-3 px-1">Reason Stated</span>
            <span className="col-span-1 text-center">Apprv</span>
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 h-[7.5mm] border-b border-gray-200 last:border-b-0 items-center px-2 text-[8pt]">
              <span className="col-span-1 border-r border-gray-200 h-full flex items-center" />
              <span className="col-span-2 border-r border-gray-200 h-full flex items-center" />
              <span className="col-span-3 border-r border-gray-200 h-full flex items-center" />
              <span className="col-span-2 border-r border-gray-200 h-full flex items-center justify-end" />
              <span className="col-span-3 border-r border-gray-200 h-full flex items-center px-1" />
              <span className="col-span-1 h-full flex items-center justify-center" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Mobile Money Received Sheet */}
      <div className="space-y-1">
        <h3 className="font-bold text-[9pt] tracking-normal text-gray-800">3. Mobile Money Received (Direct Statement Log)</h3>
        <div className="border border-black">
          <div className="grid grid-cols-12 bg-gray-100 font-bold border-b border-black py-1 px-2 text-[7.5pt]">
            <span className="col-span-2">Time</span>
            <span className="col-span-4">M-Pesa / Airtel Money Reference</span>
            <span className="col-span-3 text-right">Amount UGX</span>
            <span className="col-span-3 text-center">Visit Serial</span>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 h-[7mm] border-b border-gray-200 last:border-b-0 items-center px-2 text-[8pt]">
              <span className="col-span-2 border-r border-gray-200 h-full flex items-center" />
              <span className="col-span-4 border-r border-gray-200 h-full flex items-center tabular-nums" />
              <span className="col-span-3 border-r border-gray-200 h-full flex items-center justify-end" />
              <span className="col-span-3 h-full flex items-center justify-center" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer & Countersignature */}
      <div className="border-t-2 border-black pt-2 grid grid-cols-2 gap-4 text-[8.5pt]">
        <div>
          <div>Salon Closing Time: <strong>____ : ____</strong></div>
          <div className="mt-1">Manager Sign-off: _______________________________</div>
        </div>
        <div className="text-right">
          <div>Verified Bank Deposit Total: <strong>UGX __________________</strong></div>
          <div className="text-[7.5pt] text-gray-600 mt-1">Retained for Audit Trail • Appendix A Walkthrough</div>
        </div>
      </div>
    </div>
  );
}
