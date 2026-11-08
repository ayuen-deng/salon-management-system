'use client';

import React from 'react';
import { Button } from '@/shared/views/ui/button';

export function PaperFallbackFormsView() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-12 print:p-0 print:space-y-8 bg-white">
      <div className="flex justify-between items-center print:hidden border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Paper Fallback Forms (Appendix A)</h1>
          <p className="text-sm text-muted-foreground">Print pads of these sheets to operate during outages</p>
        </div>
        <Button onClick={() => window.print()}>Print Form Sheets</Button>
      </div>

      {/* FORM 1: VISIT SHEET */}
      <div className="border-2 border-black p-6 space-y-4 rounded-md">
        <div className="flex justify-between border-b-2 border-black pb-2 items-center">
          <span className="font-bold text-lg  tracking-normal">Form 1: Customer Visit Sheet</span>
          <span className="tabular-nums text-base font-bold">Serial No: R-___________</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>Customer Name: _________________________________</div>
          <div>Phone Number: _________________________________</div>
          <div>Arrival Time: __________________ (Read back verified: [ ])</div>
          <div>Paper Code: P-_____ (e.g. P01)</div>
        </div>
        <div className="border border-black mt-2">
          <div className="grid grid-cols-5 text-xs font-bold border-b border-black p-1 bg-slate-100">
            <span className="col-span-2">Service & Variant</span>
            <span>Staff Name</span>
            <span>Start Time</span>
            <span>End Time</span>
          </div>
          <div className="grid grid-cols-5 text-xs border-b border-black p-2 h-10">
            <span className="col-span-2">1.</span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="grid grid-cols-5 text-xs border-b border-black p-2 h-10">
            <span className="col-span-2">2.</span>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs pt-2">
          <div>Discount: UGX ________ Reason: _____________ Approver Initials: _____</div>
          <div>Total Paid: UGX ________ Method: Cash [ ] / MoMo [ ] Ref: ____________</div>
        </div>
        <div className="border-t border-dashed pt-2 text-right text-xs">
          Entered in system by: ____________________ Date/Time: ____________________
        </div>
      </div>
    </div>
  );
}
