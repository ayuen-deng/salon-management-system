import { supabase, getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';

export interface PaymentPayload {
  visitId: string;
  method: 'cash' | 'mobile_money';
  amountUgx: number;
  providerReference?: string;
  idempotencyKey: string;
}

export class PaymentRepository {
  async processPayment(payload: PaymentPayload): Promise<Result<{ payment_id: string; is_paid: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client.rpc('record_payment', {
        p_visit_id: payload.visitId,
        p_method: payload.method,
        p_amount_ugx: payload.amountUgx,
        p_provider_reference: payload.providerReference || null,
        p_idempotency_key: payload.idempotencyKey,
      });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (data && data.error) return fail({ code: 'CONFLICT', message: data.message });
      return ok(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment error';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}
