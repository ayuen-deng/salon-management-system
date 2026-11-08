'use server';

import { receiptRepo, ReceiptSnapshot } from '../models/receipt.repository';
import { Result } from '@/shared/models/result';
import { getAuthUser } from '@/modules/auth';

export async function getReceiptAction(
  visitId: string,
  options: { duplicate?: boolean; reprintedAt?: string } = {}
): Promise<Result<ReceiptSnapshot>> {
  return receiptRepo.getOrGenerateReceipt(visitId, options);
}

export async function markReceiptReprintAction(
  visitId: string
): Promise<Result<{ print_count: number; reprinted_at: string }>> {
  const user = await getAuthUser();
  if (!user || !['receptionist', 'manager'].includes(user.role)) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'You are not allowed to reprint this receipt.' },
    };
  }
  return receiptRepo.markDuplicatePrint(visitId, { id: user.id, role: user.role });
}
