import React from 'react';
import { ReceiptSnapshot } from '../models/receipt.repository';
import { formatUGX } from '@/shared/models/money';

interface PrintableReceiptProps {
  receipt: ReceiptSnapshot;
  paperWidth?: '80mm' | 'a5';
  duplicate?: boolean;
  reprintedAt?: string;
}

export function PrintableReceipt({
  receipt,
  paperWidth = '80mm',
  duplicate = receipt.is_duplicate,
  reprintedAt = receipt.reprinted_at,
}: PrintableReceiptProps) {
  // Format date and time in Africa/Kampala
  const dateObj = new Date(receipt.issued_at);
  const formattedDate = dateObj.toLocaleDateString('en-GB', {
    timeZone: 'Africa/Kampala',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Kampala',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const formattedReprintedAt = reprintedAt
    ? new Date(reprintedAt).toLocaleString('en-GB', {
        timeZone: 'Africa/Kampala',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';

  const widthClass = paperWidth === 'a5' ? 'w-[148mm]' : 'w-[80mm] max-w-[80mm]';
  const customerFirstName = (receipt.customer_first_name || 'Guest').trim().split(/\s+/)[0];

  return (
    <div
      id="receipt-print-root"
      className={`receipt-print-root bg-white text-black font-sans leading-tight p-4 mx-auto ${widthClass} print:w-[80mm] print:max-w-[80mm] print:p-2 print:m-0`}
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      {/* Header */}
      <div className="text-center pb-3 border-b border-black">
        <h1 className="font-bold text-base tracking-tight">{receipt.salon_name}</h1>
        <div className="text-xs font-medium">{receipt.location_name}</div>
        {receipt.receipt_address && <div className="text-[10px] text-gray-700">{receipt.receipt_address}</div>}
        {receipt.receipt_phone && <div className="text-[10px] text-gray-700">Tel: {receipt.receipt_phone}</div>}

        {/* Badges for DUPLICATE, VOID, REFUNDED */}
        {receipt.payment_status === 'void' && (
          <div className="mt-2 py-1 px-2 border-2 border-black font-extrabold text-sm text-center">
            *** VOID ***
          </div>
        )}
        {receipt.payment_status === 'refunded' && (
          <div className="mt-2 py-1 px-2 border-2 border-black font-extrabold text-sm text-center">
            *** REFUNDED ***
          </div>
        )}
        {duplicate && (
          <div className="mt-2 py-1 px-2 border-2 border-black font-extrabold text-sm text-center">
            DUPLICATE
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="py-2.5 border-b border-black text-xs space-y-1">
        <div className="flex justify-between">
          <span className="font-medium">Receipt no:</span>
          <span className="tabular-nums font-semibold">{receipt.receipt_no}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Ticket code:</span>
          <span className="font-extrabold text-sm">{receipt.ticket_code}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Date & time:</span>
          <span className="tabular-nums">
            {formattedDate} {formattedTime} (EAT)
          </span>
        </div>
        {duplicate && formattedReprintedAt && (
          <div className="flex justify-between">
            <span className="font-medium">Reprinted:</span>
            <span className="tabular-nums">{formattedReprintedAt} (EAT)</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="font-bold">Customer:</span>
          <span className="font-medium">{customerFirstName}</span>
        </div>
      </div>

      {/* Services Breakdown */}
      <div className="py-2.5 border-b border-black text-xs space-y-1.5">
        <div className="font-bold text-[10px] pb-1 border-b border-gray-300 flex justify-between">
          <span>Service Description</span>
          <span>Amount</span>
        </div>
        {receipt.lines.map((line, idx) => (
          <div key={idx} className="flex justify-between text-xs items-start">
            <div className="pr-2 leading-snug">
              <div className="font-semibold">{line.service_name}</div>
              <div className="text-[10px] text-gray-600">{line.variant_name}</div>
            </div>
            <div className="tabular-nums font-semibold shrink-0">{formatUGX(line.final_price_ugx)}</div>
          </div>
        ))}
      </div>

      {/* Financials */}
      <div className="py-2.5 border-b border-black text-xs space-y-1.5">
        {receipt.total_discount_ugx > 0 && (
          <>
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="tabular-nums">{formatUGX(receipt.subtotal_ugx)}</span>
            </div>
            <div className="flex justify-between text-gray-800">
              <span>Discount:</span>
              <span className="tabular-nums">- {formatUGX(receipt.total_discount_ugx)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-gray-400">
          <span>Total paid:</span>
          <span className="tabular-nums">{formatUGX(receipt.total_final_ugx)}</span>
        </div>
        <div className="flex justify-between text-[11px] pt-1">
          <span>Payment method:</span>
          <span className="font-semibold">
            {receipt.payments?.length
              ? [...new Set(receipt.payments.map((payment) => payment.method === 'momo' ? 'Mobile Money' : 'Cash'))].join(' + ')
              : receipt.payment_method === 'momo' ? 'Mobile Money' : 'Cash'}
          </span>
        </div>
        {(receipt.payments?.filter((payment) => payment.method === 'momo' && payment.provider_reference) || []).map((payment, index) => (
          <div key={`${payment.provider_reference}-${index}`} className="flex justify-between text-[11px]">
            <span>Mobile Money reference:</span>
            <span className="tabular-nums font-semibold">{payment.provider_reference}</span>
          </div>
        ))}
        {!receipt.payments?.length && receipt.provider_reference && (
          <div className="flex justify-between text-[11px]">
            <span>Mobile Money reference:</span>
            <span className="tabular-nums font-semibold">{receipt.provider_reference}</span>
          </div>
        )}
      </div>

      {/* Footers */}
      <div className="pt-3 text-center space-y-1.5 text-[10px] text-gray-700">
        {receipt.receipt_footer && <p className="font-medium border-t border-dashed border-black pt-2">{receipt.receipt_footer}</p>}
        {receipt.fiscal_disclaimer_enabled && <p className="pt-1">This is not a fiscal tax receipt.</p>}
      </div>
    </div>
  );
}

export const ReceiptDocument = PrintableReceipt;
