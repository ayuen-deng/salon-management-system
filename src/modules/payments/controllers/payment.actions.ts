'use server';

import { PaymentRepository, PaymentPayload } from '../models/payment.repository';
import { Result } from '@/shared/models/result';

class PaymentController {
  private repo = new PaymentRepository();

  async submitPayment(payload: PaymentPayload): Promise<Result<{ payment_id: string; is_paid: boolean }>> {
    return this.repo.processPayment(payload);
  }
}

export async function recordPaymentAction(payload: PaymentPayload): Promise<Result<{ payment_id: string; is_paid: boolean }>> {
    const controller = new PaymentController();
  return controller.submitPayment(payload);
}


