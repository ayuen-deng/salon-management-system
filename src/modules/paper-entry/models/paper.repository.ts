import { getServiceRoleClient } from '@/shared/lib/supabase';
import { ok, fail, type Result } from '@/shared/models/result';
import { normalizeUgPhone } from '@/shared/models/phone';

export interface PaperCatalogueItem {
  id: string;
  name: string;
  category: string;
  variants: Array<{
    id: string;
    name: string;
    list_price_ugx: number;
  }>;
}

export interface PaperStaffMember {
  id: string;
  display_name: string;
}

export class PaperRepository {
  async getPaperCatalogue(): Promise<Result<PaperCatalogueItem[]>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('service')
        .select(`
          id, name, category, is_active,
          variants:service_variant ( id, name, list_price_ugx, is_active )
        `)
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      const mapped = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        variants: (s.variants || [])
          .filter((v: any) => v.is_active)
          .map((v: any) => ({
            id: v.id,
            name: v.name,
            list_price_ugx: Number(v.list_price_ugx),
          })),
      }));

      return ok(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query paper catalogue';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getPaperStaff(): Promise<Result<PaperStaffMember[]>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('app_user')
        .select('id, display_name, role, is_active')
        .eq('is_active', true)
        .in('role', ['staff', 'manager'])
        .order('display_name', { ascending: true });

      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });

      return ok(
        (data || []).map((u: any) => ({
          id: u.id,
          display_name: u.display_name,
        }))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to query staff list';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async enterPaperVisit(params: {
    customerPhone: string;
    customerName: string;
    variantId: string;
    staffUserId?: string;
    amountUgx: number;
    paperSerial: string;
    actorUserId: string;
    actorRole: 'receptionist' | 'manager';
  }): Promise<Result<{ ticket_code: string; visit_id: string }>> {
    try {
      const client = getServiceRoleClient();
      const cleanSerial = params.paperSerial.trim();
      if (!cleanSerial) {
        return fail({ code: 'VALIDATION_ERROR', message: 'Paper serial or tally reference is mandatory.' });
      }

      // Check for duplicate paper serial
      const { data: existingSerial } = await client
        .from('visit')
        .select('id, ticket_code')
        .eq('paper_serial', cleanSerial)
        .maybeSingle();

      if (existingSerial) {
        return fail({
          code: 'CONFLICT',
          message: `Paper serial "${cleanSerial}" has already been entered into the system (Ticket ${existingSerial.ticket_code}). Duplicate paper entries are strictly rejected.`,
        });
      }

      const { data: bday } = await client
        .from('business_day')
        .select('*')
        .eq('status', 'open')
        .maybeSingle();

      if (!bday) return fail({ code: 'CONFLICT', message: 'No open business day found. Start the day first.' });

      // Find or create customer
      const normalizedPhone = normalizeUgPhone(params.customerPhone);
      let { data: cust } = await client
        .from('customer')
        .select('id')
        .eq('phone_e164', normalizedPhone)
        .maybeSingle();

      if (!cust) {
        const { data: newCust, error: cErr } = await client
          .from('customer')
          .insert({
            organization_id: bday.organization_id,
            location_id: bday.location_id,
            phone_e164: normalizedPhone,
            first_name: params.customerName.trim() || 'Walk-in Guest',
            created_by: params.actorUserId,
          })
          .select('id')
          .single();

        if (cErr || !newCust) {
          return fail({ code: 'INTERNAL_ERROR', message: cErr?.message || 'Could not create customer.' });
        }
        cust = newCust;
      }

      // Generate paper ticket code PXX
      const ticketSeq = Math.floor(10 + Math.random() * 89);
      const ticketCode = `P${ticketSeq}`;
      const now = new Date().toISOString();

      // Create Visit tagged as entered_via: 'paper', paper_serial: cleanSerial
      const { data: visit, error: vErr } = await client
        .from('visit')
        .insert({
          organization_id: bday.organization_id,
          location_id: bday.location_id,
          business_day_id: bday.id,
          customer_id: cust.id,
          status: 'paid',
          source: 'walk_in',
          entered_via: 'paper',
          paper_serial: cleanSerial,
          ticket_code: ticketCode,
          queued_at: now,
          created_via: params.actorRole === 'receptionist' ? 'receptionist' : 'receptionist',
          total_list_ugx: params.amountUgx,
          total_discount_ugx: 0,
          total_final_ugx: params.amountUgx,
        })
        .select('id')
        .single();

      if (vErr || !visit) {
        return fail({ code: 'INTERNAL_ERROR', message: vErr?.message || 'Failed creating paper visit record.' });
      }

      // Create Visit Service line marked as done with times_source: 'reported'
      await client.from('visit_service').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        visit_id: visit.id,
        service_variant_id: params.variantId,
        sequence_no: 1,
        status: 'done',
        assignment_mode: params.staffUserId ? 'strict' : 'any',
        staff_user_id: params.staffUserId || null,
        list_price_ugx: params.amountUgx,
        discount_ugx: 0,
        final_price_ugx: params.amountUgx,
        price_source: 'custom_override',
        times_source: 'reported',
        started_at: now,
        ended_at: now,
      });

      // Record cash payment
      await client.from('payment').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        visit_id: visit.id,
        business_day_id: bday.id,
        method: 'cash',
        provider: 'manual',
        amount_ugx: params.amountUgx,
        status: 'confirmed',
        confirmation_level: 'confirmed_via_provider',
        provider_reference: cleanSerial,
        idempotency_key: `PAPER-${cleanSerial}-${Date.now()}`,
        recorded_by: params.actorUserId,
      });

      // Audit log entry
      await client.from('audit_log').insert({
        organization_id: bday.organization_id,
        location_id: bday.location_id,
        actor_id: params.actorUserId,
        actor_role: params.actorRole,
        action: 'PAPER_VISIT_ENTERED',
        entity_type: 'visit',
        entity_id: visit.id,
        business_day_id: bday.id,
        category: 'operations',
        reason: `Paper tally sheet entry serial: ${cleanSerial}`,
        after: { ticket_code: ticketCode, paper_serial: cleanSerial, amount_ugx: params.amountUgx },
      });

      return ok({ ticket_code: ticketCode, visit_id: visit.id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error recording paper entry';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}

export const paperRepo = new PaperRepository();
