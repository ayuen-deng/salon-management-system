import { createHash, randomBytes } from 'crypto';
import { getServiceRoleClient } from '@/shared/lib/supabase';
import { fail, ok, type Result } from '@/shared/models/result';

export interface KioskOrderLineInput {
  variantId: string;
  quantity: number;
}

export interface KioskOrderResult {
  visit_id: string;
  order_code: string;
  first_name: string;
  phone: string;
  total_ugx: number;
  wait_minutes: number;
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

export class KioskOrderRepository {
  async getBusinessDayStatus(sessionToken: string): Promise<Result<{ is_open: boolean; expected_open: string }>> {
    try {
      const { data, error } = await getServiceRoleClient().rpc('kiosk_business_day_status', {
        p_session_hash: tokenHash(sessionToken),
      });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (!data?.success) return fail({ code: 'FORBIDDEN', message: 'The paired tablet session has expired. Ask a manager to pair it again.' });
      return ok({ is_open: Boolean(data.is_open), expected_open: data.expected_open || '08:00' });
    } catch (error) {
      return fail({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Could not check the business day.' });
    }
  }

  async pairDevice(pairingCode: string): Promise<Result<{ sessionToken: string }>> {
    try {
      const client = getServiceRoleClient();
      const sessionToken = randomBytes(32).toString('base64url');
      const { data, error } = await client.rpc('register_kiosk_device_session', {
        p_pairing_code: pairingCode.trim(),
        p_session_hash: tokenHash(sessionToken),
      });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (!data?.success) return fail({ code: data?.code === 'INVALID_PAIRING' ? 'FORBIDDEN' : 'VALIDATION_ERROR', message: data?.message || 'Could not pair this tablet.' });
      return ok({ sessionToken });
    } catch (error) {
      return fail({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Could not pair this tablet.' });
    }
  }

  async createOrder(input: {
    sessionToken: string;
    idempotencyKey: string;
    firstName: string;
    phone: string;
    lines: KioskOrderLineInput[];
  }): Promise<Result<KioskOrderResult>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client.rpc('create_kiosk_order', {
        p_session_hash: tokenHash(input.sessionToken),
        p_idempotency_key: input.idempotencyKey,
        p_first_name: input.firstName,
        p_phone: input.phone,
        p_lines: input.lines.map((line) => ({ variant_id: line.variantId, quantity: line.quantity })),
      });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (!data?.success) {
        const code = data?.code === 'DAY_CLOSED' || data?.code === 'RATE_LIMITED' || data?.code === 'ORDER_NO_LONGER_PENDING' ? 'CONFLICT' :
          data?.code === 'DEVICE_SESSION_REQUIRED' ? 'FORBIDDEN' : 'VALIDATION_ERROR';
        return fail({ code, message: data?.message || 'Could not place this order.' });
      }
      return ok({
        visit_id: data.visit_id,
        order_code: data.order_code,
        first_name: data.first_name,
        phone: data.phone,
        total_ugx: Number(data.total_ugx),
        wait_minutes: Number(data.wait_minutes),
      });
    } catch (error) {
      return fail({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Could not place this order.' });
    }
  }
}
