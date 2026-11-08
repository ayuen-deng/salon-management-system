import { Metadata } from 'next';
import { getReceiptAction } from '@/modules/payments';
import { ReceiptDocument } from '@/modules/payments/views/printable-receipt';
import { ReceiptPrintClient } from './receipt-print-client';

export const metadata: Metadata = {
  title: 'Receipt - Print',
};

interface PageProps {
  params: Promise<{ receiptId: string }>;
  searchParams: Promise<{ width?: string; auto?: string; duplicate?: string; reprintedAt?: string }>;
}

export default async function ReceiptPrintPage({ params, searchParams }: PageProps) {
  const { receiptId } = await params;
  const { width, auto, duplicate, reprintedAt } = await searchParams;

  const res = await getReceiptAction(receiptId, {
    duplicate: duplicate === 'true',
    reprintedAt,
  });

  if (!res.success || !res.data) {
    return (
      <div className="p-8 text-center text-sm font-medium text-black">
        Receipt not found for visit {receiptId}.
      </div>
    );
  }

  const receipt = res.data;
  const paperWidth = width === 'a5' ? 'a5' : '80mm';
  const autoPrint = auto === 'true';

  return (
      <div className="bg-white min-h-screen flex flex-col items-center justify-start p-2 print:p-0">
      <ReceiptPrintClient autoPrint={autoPrint} />
      <ReceiptDocument receipt={receipt} paperWidth={paperWidth} duplicate={duplicate === 'true'} reprintedAt={reprintedAt} />
    </div>
  );
}
