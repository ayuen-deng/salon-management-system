'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/shared/views/ui/button';
import { createReportPdf } from '@/shared/lib/report-pdf';
import { recordHrReportExportAction } from '@/modules/people-hr/controllers/hr.actions';

export interface HrExportColumn { label: string; value: (row: any) => unknown }
interface Props { title: string; filename: string; rows: any[]; columns: HrExportColumn[]; filters?: string }

function safeCsv(value: unknown) { const text = String(value ?? '').replace(/^([=+\-@])/g, "'$1"); return `"${text.replaceAll('"', '""')}"`; }

export function HrExportMenu({ title, filename, rows, columns, filters = 'All records' }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function exportFile(format: 'CSV' | 'PDF') {
    setBusy(true); setError('');
    try {
      const now = new Date();
      const dateParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Kampala', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
      const dateValues = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
      const dateStamp = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
      const generatedAt = now.toLocaleString('en-GB', { timeZone: 'Africa/Kampala', dateStyle: 'medium', timeStyle: 'short' });
      let blob: Blob;
      if (format === 'CSV') {
        const csv = [columns.map((column) => safeCsv(column.label)).join(','), ...rows.map((row) => columns.map((column) => safeCsv(column.value(row))).join(','))].join('\r\n');
        blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      } else {
        const pdf = await createReportPdf({ title, columns: columns.map((column) => column.label), rows: rows.map((row) => columns.map((column) => String(column.value(row) ?? '—'))), filters, generatedAt, generatedBy: 'HR' });
        blob = new Blob([pdf as BlobPart], { type: 'application/pdf' });
      }
      const result = await recordHrReportExportAction({ title, format, filters, recordCount: rows.length });
      if (!result.success) throw new Error(result.error?.message || 'Could not record this export. Retry the export.');
      if (format === 'PDF') {
        const pdf = await createReportPdf({ title, columns: columns.map((column) => column.label), rows: rows.map((row) => columns.map((column) => String(column.value(row) ?? '—'))), filters, generatedAt, generatedBy: result.data?.actorName || 'HR' });
        blob = new Blob([pdf as BlobPart], { type: 'application/pdf' });
      }
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = `${filename}-${dateStamp}.${format.toLowerCase()}`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Export failed. Retry.'); }
    finally { setBusy(false); }
  }
  return <div className="inline-flex items-center gap-1">
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => exportFile('CSV')}><Download className="mr-1.5 h-4 w-4"/>{busy ? 'Preparing…' : 'CSV'}</Button>
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => exportFile('PDF')}>PDF</Button>
    {error && <span role="alert" className="ml-2 text-xs text-rose-700">{error}</span>}
  </div>;
}
