'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { Printer, FileText, CheckCircle2, Download } from 'lucide-react';

export function ManagerPaperFormsView() {
  const forms = [
    {
      id: 'QUEUE_TALLY',
      title: 'Reception Queue & Walk-in Tally Sheet',
      description: 'Clipboard template for logging customer arrivals, requested services, assigned stylists, and manual cash tickets during power outages.',
      columns: ['Ticket #', 'Arrival Time', 'Customer Name', 'Phone', 'Service', 'Stylist', 'Cash UGX', 'Signature'],
    },
    {
      id: 'DRAWER_COUNT',
      title: 'Cash Drawer Handover & Counting Sheet',
      description: 'Physical audit form for counting cash floats, morning opening, and evening shift close denomination totals.',
      columns: ['Denomination', 'Count', 'Total UGX', 'Checked By', 'Manager Sign-off'],
    },
    {
      id: 'STYLIST_SERVICES',
      title: 'Stylist Service Log & Commission Voucher',
      description: 'Station-side paper log for multi-stage handovers, blow-dry queue slips, and emergency manual ticket tracking.',
      columns: ['Station #', 'Stylist', 'Ticket Code', 'Stage Completed', 'Ready Next', 'Time Out'],
    },
  ];

  const handlePrint = (formTitle: string) => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Standard Paper Forms & Templates</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Printable physical backup sheets for power outages, manual queueing, and cash counts (PDF Appendix B)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {forms.map((f) => (
          <Card key={f.id} className="flex flex-col justify-between">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {f.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 flex-1 flex flex-col justify-between">
              <p className="text-xs text-muted-foreground">{f.description}</p>

              <div className="bg-slate-50 p-3 rounded-xl space-y-1.5">
                <span className="text-[10px] font-bold  text-slate-500 tracking-normal block">
                  Sheet Fields
                </span>
                <div className="flex flex-wrap gap-1">
                  {f.columns.map((c, idx) => (
                    <span key={idx} className="text-[10px] bg-white border px-1.5 py-0.5 rounded text-slate-700">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => handlePrint(f.title)}
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print Template (A4)
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
