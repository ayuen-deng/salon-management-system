'use client';

import { markReceiptReprintAction } from '../controllers/receipt.actions';
import { printReceipt as printReceiptFrame } from '@/shared/lib/receipt-printing';
import { fail, ok, Result } from '@/shared/models/result';

export async function printVisitReceipt(
  visitId: string,
  options: { duplicate?: boolean } = {}
): Promise<Result<{ print_count?: number }>> {
  let printCount: number | undefined;
  let reprintedAt: string | undefined;

  if (options.duplicate) {
    const marked = await markReceiptReprintAction(visitId);
    if (!marked.success) return marked;
    printCount = marked.data.print_count;
    reprintedAt = marked.data.reprinted_at;
  }

  try {
    await printReceiptFrame(visitId, { ...options, reprintedAt });
    return ok({ print_count: printCount });
  } catch (error) {
    return fail({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Could not print the receipt.',
    });
  }
}
