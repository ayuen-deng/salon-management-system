import { supabase } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';
import { normalizeUgPhone } from '@/shared/models/phone';

export interface CustomerProfile {
  id: string;
  phone_e164: string;
  first_name: string;
  created_at: string;
}

export class CustomerRepository {
  async lookupByPhone(phone: string): Promise<Result<CustomerProfile[]>> {
    try {
      const normalized = normalizeUgPhone(phone);
      const { data, error } = await supabase
        .from('customer')
        .select('id, phone_e164, first_name, created_at')
        .eq('phone_e164', normalized)
        .is('merged_into', null);

      if (error) {
        return fail({ code: 'INTERNAL_ERROR', message: error.message });
      }
      return ok(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Customer lookup failure';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async createCustomer(payload: { phone: string; first_name: string }): Promise<Result<CustomerProfile>> {
    try {
      const normalized = normalizeUgPhone(payload.phone);
      const { data, error } = await supabase
        .from('customer')
        .insert({
          organization_id: 'a0000000-0000-0000-0000-000000000001',
          location_id: 'b0000000-0000-0000-0000-000000000001',
          phone_e164: normalized,
          first_name: payload.first_name,
        })
        .select('id, phone_e164, first_name, created_at')
        .single();

      if (error) {
        return fail({ code: 'INTERNAL_ERROR', message: error.message });
      }
      return ok(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Customer creation failure';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}
