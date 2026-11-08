import { getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';

export interface ReceiptLineItem {
  service_name: string;
  variant_name: string;
  final_price_ugx: number;
}

export interface ReceiptPaymentItem {
  method: 'cash' | 'momo';
  amount_ugx: number;
  provider_reference?: string;
}

export interface ReceiptSnapshot {
  id: string; // receipt id / reference
  receipt_no: string;
  visit_id: string;
  ticket_code: string;
  customer_first_name: string;
  issued_at: string;
  salon_name: string;
  location_name: string;
  receipt_address: string;
  receipt_phone: string;
  receipt_footer: string;
  fiscal_disclaimer_enabled: boolean;
  lines: ReceiptLineItem[];
  payments: ReceiptPaymentItem[];
  subtotal_ugx: number;
  total_discount_ugx: number;
  total_final_ugx: number;
  payment_method: 'cash' | 'momo';
  payment_status: 'confirmed' | 'void' | 'refunded';
  provider_reference?: string;
  print_count: number;
  is_duplicate: boolean;
  reprinted_at?: string;
}

export class ReceiptRepository {
  /**
   * Generates or fetches an immutable receipt snapshot for a visit/payment.
   * If existing snapshot exists in payment.raw_payload or audit_log, returns it.
   * Otherwise constructs it from the visit and payment records and persists it.
   */
  async getOrGenerateReceipt(
    visitId: string,
    options: { duplicate?: boolean; reprintedAt?: string } = {}
  ): Promise<Result<ReceiptSnapshot>> {
    try {
      const client = getServiceRoleClient();

      // 1. Fetch visit details
      const { data: visit, error: vErr } = await client
        .from('visit')
        .select(`
          id,
          location_id,
          ticket_code,
          customer_id,
          total_list_ugx,
          total_discount_ugx,
          total_final_ugx,
          status,
          created_at,
          customer:customer_id ( first_name ),
          lines:visit_service (
            id,
            final_price_ugx,
            service_variant:service_variant_id (
              name,
              service:service_id ( name )
            )
          ),
          payments:payment (
            id,
            method,
            amount_ugx,
            provider_reference,
            status,
            raw_payload,
            created_at,
            recorded_by
          )
        `)
        .eq('id', visitId)
        .single();

      if (vErr || !visit) {
        return fail({ code: 'NOT_FOUND', message: `Visit ${visitId} not found` });
      }

      const { data: receiptRow, error: receiptError } = await client
        .from('receipt')
        .select('id, receipt_no, issued_at, snapshot, print_count, last_printed_at')
        .eq('visit_id', visitId)
        .maybeSingle();
      if (receiptError) return fail({ code: 'INTERNAL_ERROR', message: receiptError.message });

      // Check payments
      const payments = (visit.payments || []).sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latestPayment = payments[0];

      const legacySnapshot = latestPayment?.raw_payload?.receipt_snapshot as ReceiptSnapshot | undefined;
      const receiptSnapshot = receiptRow?.snapshot as ReceiptSnapshot | null;
      let saved = receiptSnapshot?.receipt_no ? receiptSnapshot : legacySnapshot;

      if (!saved) {
        if (!latestPayment?.id) return fail({ code: 'NOT_FOUND', message: 'No payment receipt exists for this visit.' });

        const { data: settings } = await client
          .from('app_setting')
          .select('key, value')
          .eq('location_id', visit.location_id)
          .in('key', [
            'salon_name',
            'location_name',
            'receipt_address',
            'receipt_phone',
            'receipt_footer',
            'receipt_fiscal_disclaimer_enabled',
          ]);

        const settingMap: Record<string, string> = {
          salon_name: '',
          location_name: '',
          receipt_address: '',
          receipt_phone: '',
          receipt_footer: '',
          receipt_fiscal_disclaimer_enabled: 'true',
        };
        (settings || []).forEach((setting: any) => {
          if (setting.value !== null && setting.value !== undefined) {
            settingMap[setting.key] = typeof setting.value === 'string' ? setting.value : String(setting.value);
          }
        });

        const lines: ReceiptLineItem[] = ((visit.lines as any[]) || []).map((line) => ({
          service_name: line.service_variant?.service?.name || 'Salon Service',
          variant_name: line.service_variant?.name || 'Standard',
          final_price_ugx: Number(line.final_price_ugx),
        }));
        const rawFirstName = (visit.customer as any)?.first_name || 'Guest';
        const receiptId = crypto.randomUUID();
        const receiptNo = `REC-${receiptId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
        const status = latestPayment.status === 'voided' || latestPayment.status === 'void'
          ? 'void'
          : latestPayment.status === 'refunded' ? 'refunded' : 'confirmed';

        saved = {
          id: receiptId,
          receipt_no: receiptNo,
          visit_id: visit.id,
          ticket_code: visit.ticket_code || 'T01',
          customer_first_name: rawFirstName.trim().split(/\s+/)[0],
          issued_at: latestPayment.created_at,
          salon_name: settingMap.salon_name,
          location_name: settingMap.location_name,
          receipt_address: settingMap.receipt_address,
          receipt_phone: settingMap.receipt_phone,
          receipt_footer: settingMap.receipt_footer,
          fiscal_disclaimer_enabled: settingMap.receipt_fiscal_disclaimer_enabled !== 'false',
          lines,
          payments: payments.map((payment: any) => ({
            method: payment.method === 'mobile_money' ? 'momo' : 'cash',
            amount_ugx: Number(payment.amount_ugx),
            provider_reference: payment.provider_reference || undefined,
          })),
          subtotal_ugx: Number(visit.total_list_ugx) || Number(visit.total_final_ugx),
          total_discount_ugx: Number(visit.total_discount_ugx) || 0,
          total_final_ugx: Number(visit.total_final_ugx),
          payment_method: latestPayment.method === 'mobile_money' ? 'momo' : 'cash',
          payment_status: status,
          provider_reference: latestPayment.provider_reference || undefined,
          print_count: 1,
          is_duplicate: false,
        };
      }

      const legacyAddress = saved.receipt_address === 'High Street, Mbarara, Uganda' ? '' : saved.receipt_address || '';
      const legacyPhone = saved.receipt_phone === '+256 772 123 456' ? '' : saved.receipt_phone || '';
      const legacyFooter = saved.receipt_footer === 'Thank you for visiting Mzuri Unisex Salon!' ? '' : saved.receipt_footer || '';
      const receiptId = receiptRow?.id || saved.id || crypto.randomUUID();
      const receiptNo = receiptRow?.receipt_no || saved.receipt_no || `REC-${receiptId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      const immutableSnapshot: ReceiptSnapshot = {
        ...saved,
        id: receiptId,
        receipt_no: receiptNo,
        visit_id: visit.id,
        customer_first_name: (saved.customer_first_name || 'Guest').trim().split(/\s+/)[0],
        receipt_address: legacyAddress,
        receipt_phone: legacyPhone,
        receipt_footer: legacyFooter,
        salon_name: toSalonSentenceCase(saved.salon_name),
        payments: saved.payments || payments.map((payment: any) => ({
          method: payment.method === 'mobile_money' ? 'momo' : 'cash',
          amount_ugx: Number(payment.amount_ugx),
          provider_reference: payment.provider_reference || undefined,
        })),
        fiscal_disclaimer_enabled: saved.fiscal_disclaimer_enabled !== false,
      };

      if (!latestPayment?.recorded_by) {
        return fail({ code: 'VALIDATION_ERROR', message: 'The receipt payment has no recorded issuer.' });
      }

      if (receiptRow && !receiptSnapshot?.receipt_no) {
        const { error: updateError } = await client.from('receipt').update({
          receipt_no: receiptNo,
          issued_at: immutableSnapshot.issued_at,
          issued_by: latestPayment.recorded_by,
          snapshot: immutableSnapshot,
        }).eq('id', receiptRow.id);
        if (updateError) return fail({ code: 'INTERNAL_ERROR', message: updateError.message });
      } else if (!receiptRow) {
        const { error: insertError } = await client.from('receipt').insert({
          id: receiptId,
          location_id: visit.location_id,
          visit_id: visit.id,
          receipt_no: receiptNo,
          issued_at: immutableSnapshot.issued_at,
          issued_by: latestPayment.recorded_by,
          snapshot: immutableSnapshot,
          print_count: Number(legacySnapshot?.print_count || 1),
        });
        if (insertError) {
          if (/duplicate|unique/i.test(insertError.message)) return this.getOrGenerateReceipt(visitId, options);
          return fail({ code: 'INTERNAL_ERROR', message: insertError.message });
        }
      }

      if (latestPayment?.status === 'voided' || latestPayment?.status === 'void') {
        immutableSnapshot.payment_status = 'void';
      } else if (latestPayment?.status === 'refunded') {
        immutableSnapshot.payment_status = 'refunded';
      }
      immutableSnapshot.print_count = Number(receiptRow?.print_count || legacySnapshot?.print_count || 1);
      immutableSnapshot.is_duplicate = options.duplicate === true;
      immutableSnapshot.reprinted_at = options.duplicate ? options.reprintedAt : undefined;
      return ok(immutableSnapshot);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate receipt';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async markDuplicatePrint(
    visitId: string,
    actor: { id: string; role: string }
  ): Promise<Result<{ print_count: number; reprinted_at: string }>> {
    try {
      const receiptResult = await this.getOrGenerateReceipt(visitId);
      if (!receiptResult.success) return receiptResult;
      const client = getServiceRoleClient();
      const { data, error } = await client.rpc('mark_receipt_reprint', {
        p_visit_id: visitId,
        p_actor_id: actor.id,
        p_actor_role: actor.role,
      });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      return ok(data as { print_count: number; reprinted_at: string });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to mark reprint';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}

export const receiptRepo = new ReceiptRepository();

function toSalonSentenceCase(value: string): string {
  if (!value) return '';
  if (value === value.toUpperCase()) return 'Mzuri Unisex Salon';
  return value;
}
