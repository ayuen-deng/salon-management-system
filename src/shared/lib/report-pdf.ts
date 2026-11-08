import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface ReportPdfInput {
  title: string;
  columns: string[];
  rows: string[][];
  filters?: string;
  generatedBy: string;
  generatedAt: string;
}

export async function createReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const landscape = input.columns.length > 6;
  const size: [number, number] = landscape ? [842, 595] : [595, 842];
  const margin = 34;
  const rowHeight = 22;
  const usableWidth = size[0] - margin * 2;
  const widths = input.columns.map(() => usableWidth / input.columns.length);
  let page = pdf.addPage(size);
  let y = size[1] - margin;
  let pageNumber = 0;
  const drawHeader = () => {
    pageNumber += 1;
    y = size[1] - margin;
    page.drawText('MZURI UNISEX SALON · MBARARA', { x: margin, y, size: 9, font: bold, color: rgb(0.18, 0.28, 0.48) });
    y -= 22;
    page.drawText(input.title, { x: margin, y, size: 16, font: bold, color: rgb(0.08, 0.12, 0.2) });
    y -= 17;
    const details = [input.filters, `Generated ${input.generatedAt} · ${input.generatedBy}`].filter(Boolean).join(' · ');
    page.drawText(details.slice(0, 160), { x: margin, y, size: 8, font, color: rgb(0.35, 0.39, 0.45) });
    y -= 20;
    page.drawRectangle({ x: margin, y: y - 4, width: usableWidth, height: rowHeight, color: rgb(0.93, 0.95, 0.98) });
    let x = margin + 5;
    input.columns.forEach((column, i) => { page.drawText(column.slice(0, 24), { x, y: y + 3, size: 7, font: bold, color: rgb(0.18, 0.23, 0.32), maxWidth: widths[i] - 8 }); x += widths[i]; });
    y -= rowHeight;
  };
  const footer = () => page.drawText(`Confidential: contains personal data · Page ${pageNumber}`, { x: margin, y: 16, size: 7, font, color: rgb(0.45, 0.47, 0.5) });
  drawHeader();
  for (const row of input.rows) {
    if (y < 45) { footer(); page = pdf.addPage(size); drawHeader(); }
    let x = margin + 5;
    row.forEach((cell, i) => { page.drawText(String(cell ?? '—').replace(/[\r\n]+/g, ' ').slice(0, 80), { x, y, size: 7, font, color: rgb(0.12, 0.15, 0.2), maxWidth: widths[i] - 8 }); x += widths[i]; });
    y -= rowHeight;
  }
  page.drawText(`Records: ${input.rows.length}`, { x: margin, y: Math.max(y - 2, 30), size: 8, font: bold, color: rgb(0.2, 0.24, 0.31) });
  footer();
  return pdf.save();
}
