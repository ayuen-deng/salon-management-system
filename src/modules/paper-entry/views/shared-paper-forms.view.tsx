'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/shared/views/ui/card';
import { Button } from '@/shared/views/ui/button';
import { Printer, FileText, CheckCircle2, Layers, Eye, X } from 'lucide-react';
import { PAPER_FORMS_CONFIG, PaperFormDefinition } from '../models/paper-forms.config';

interface SharedPaperFormsViewProps {
  role?: 'receptionist' | 'manager';
}

export function SharedPaperFormsView({ role = 'receptionist' }: SharedPaperFormsViewProps = {}) {
  // Batch print modal state
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchCount, setBatchCount] = useState<number>(20);
  const [startingSerial, setStartingSerial] = useState<number>(1);

  // Filter forms: Manager sheet only visible to manager
  const formList = Object.values(PAPER_FORMS_CONFIG);
  const visibleForms = formList.filter((form) => {
    if (form.roleRestriction === 'manager' && role !== 'manager') {
      return false;
    }
    return true;
  });

  const handlePrintSheet = (printPath: string) => {
    window.open(printPath, '_blank', 'noopener,noreferrer');
  };

  const handleOpenBatch = () => {
    // Read next serial from localStorage if available, else 1
    const storedSerial = typeof window !== 'undefined' ? localStorage.getItem('mzuri_last_paper_serial') : null;
    const nextSerial = storedSerial ? parseInt(storedSerial, 10) + 1 : 1;
    setStartingSerial(isNaN(nextSerial) ? 1 : nextSerial);
    setBatchCount(20);
    setIsBatchOpen(true);
  };

  const handleConfirmBatch = () => {
    const nextLast = startingSerial + batchCount - 1;
    if (typeof window !== 'undefined') {
      localStorage.setItem('mzuri_last_paper_serial', nextLast.toString());
    }
    setIsBatchOpen(false);
    window.open(`/print/forms/visit-sheet?count=${batchCount}&start=${startingSerial}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Standard Paper Fallback Forms (A4)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Physical A4 handwriting forms for power outages, manual queueing, and cash counts (Appendix A & B).
          </p>
        </div>
        <Button onClick={handleOpenBatch} className="gap-2 text-xs bg-primary hover:bg-primary/90 text-white font-medium">
          <Layers className="w-4 h-4" />
          Print Pad Batch (Visit Sheets)
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleForms.map((f: PaperFormDefinition) => (
          <Card key={f.id} className="flex flex-col justify-between border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
                  <FileText className="w-4 h-4 text-primary" />
                  {f.title}
                </CardTitle>
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                  {f.layout}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-3">{f.subtitle}</p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <div className="text-[11px] font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span>Key Ruled Sections:</span>
                    <span className="text-[10px] text-slate-500 font-normal">Physical layout preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600">
                    {f.sections.slice(0, 4).map((sec, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-slate-200 truncate">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span className="truncate">{sec.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">Format: A4 Portrait</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintSheet(f.printPath)}
                    className="text-xs gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    Preview & Print
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Batch Print Modal Dialog */}
      {isBatchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base text-slate-900">Print Visit Sheet Pad Batch</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Print a pad of customer visit sheets with <strong>consecutive printed serial numbers</strong> (2 sheets per A4 page).
              After printing, Reception tears or cuts them along the dotted line and binds them into a pad.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="batchCount" className="text-xs font-semibold text-slate-800 block">
                  Number of Sheets to Print (2 per page)
                </label>
                <input
                  id="batchCount"
                  type="number"
                  min="2"
                  max="100"
                  step="2"
                  value={batchCount}
                  onChange={(e) => setBatchCount(parseInt(e.target.value, 10) || 2)}
                  className="mt-1 h-9 w-full px-3 text-sm border rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {batchCount} sheets = {Math.ceil(batchCount / 2)} sheets of A4 paper
                </p>
              </div>

              <div>
                <label htmlFor="startSerial" className="text-xs font-semibold text-slate-800 block">
                  Starting Serial Number
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded border border-slate-200">
                    R-
                  </span>
                  <input
                    id="startSerial"
                    type="number"
                    min="1"
                    value={startingSerial}
                    onChange={(e) => setStartingSerial(parseInt(e.target.value, 10) || 1)}
                    className="h-9 w-full px-3 text-sm border rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary tabular-nums"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Range: <span className="font-medium tabular-nums">R-{String(startingSerial).padStart(4, '0')}</span> to{' '}
                  <span className="font-medium tabular-nums">R-{String(startingSerial + batchCount - 1).padStart(4, '0')}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBatchOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmBatch}
                className="text-xs gap-1.5 bg-primary text-white hover:bg-primary/90"
              >
                <Printer className="w-3.5 h-3.5" />
                Generate & Print Batch
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
