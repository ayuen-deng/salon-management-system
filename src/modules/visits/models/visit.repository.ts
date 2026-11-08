import { supabase, getServiceRoleClient } from '@/shared/lib/supabase';
import { Result, ok, fail } from '@/shared/models/result';

export interface QueueDisplayBoardItem {
  ticketCode: string;
  status: 'now_serving' | 'next' | 'waiting';
  assignedTo?: string; // Stylist first name or Station name (e.g. "Grace", "Wash")
  nextDetail?: string; // e.g. "Grace · blow-dry"
  sequenceNo?: number;
  queuedAt: string;
}

export interface QueueDisplayBoardState {
  nowServing: QueueDisplayBoardItem[];
  nextUp: QueueDisplayBoardItem[];
  waitingList: QueueDisplayBoardItem[];
  estimatedWaitMinutes: number;
}

export interface VisitServiceLine {
  id: string;
  service_variant_id: string;
  staff_user_id?: string;
  status: string;
  list_price_ugx: number;
  discount_ugx: number;
  final_price_ugx: number;
  sequence_no: number;
  ready_at?: string;
  started_at?: string;
  ended_at?: string;
}

export interface VisitRecord {
  id: string;
  ticket_code: string;
  status: string;
  customer_id: string;
  total_final_ugx: number;
  queued_at?: string;
  services?: VisitServiceLine[];
}

export class VisitRepository {
  async getLiveQueue(): Promise<Result<VisitRecord[]>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client
        .from('visit')
        .select(`
          id, ticket_code, status, customer_id, total_final_ugx, queued_at,
          visit_service ( id, service_variant_id, staff_user_id, status, list_price_ugx, discount_ugx, final_price_ugx, sequence_no, ready_at, started_at, ended_at )
        `)
        .in('status', ['queued', 'in_service', 'ready_for_checkout'])
        .order('queued_at', { ascending: true });

      if (error) {
        return fail({ code: 'INTERNAL_ERROR', message: error.message });
      }
      return ok((data as unknown as VisitRecord[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching queue';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async getQueueDisplayBoard(): Promise<Result<QueueDisplayBoardState>> {
    try {
      const client = getServiceRoleClient();
      const { data: visits, error } = await client
        .from('visit')
        .select(`
          id, ticket_code, status, queued_at,
          visit_service (
            id, sequence_no, status, ready_at, started_at,
            staff_user:app_user ( id, display_name, full_name ),
            service_variant:service_variant (
              name,
              service:service ( name )
            )
          )
        `)
        .in('status', ['queued', 'in_service'])
        .order('queued_at', { ascending: true });

      if (error) {
        return fail({ code: 'INTERNAL_ERROR', message: error.message });
      }

      const nowServing: QueueDisplayBoardItem[] = [];
      const nextUp: QueueDisplayBoardItem[] = [];
      const waitingList: QueueDisplayBoardItem[] = [];

      (visits || []).forEach((v: any) => {
        const lines = (v.visit_service || []).sort((a: any, b: any) => a.sequence_no - b.sequence_no);
        const activeLine = lines.find((l: any) => l.status === 'in_progress');
        const readyLine = lines.find((l: any) => l.status === 'ready');
        const blockedLine = lines.find((l: any) => l.status === 'blocked');

        if (activeLine) {
          const stylistFirst = activeLine.staff_user?.display_name || activeLine.staff_user?.full_name?.split(' ')[0] || 'Styling';
          nowServing.push({
            ticketCode: v.ticket_code || 'TKT',
            status: 'now_serving',
            assignedTo: stylistFirst,
            queuedAt: v.queued_at,
          });
        } else if (readyLine) {
          // If customer completed line 1 and is waiting on line 2, display between services
          const prevLineDone = lines.some((l: any) => l.status === 'done' && l.sequence_no < readyLine.sequence_no);
          const stylistFirst = readyLine.staff_user?.display_name || readyLine.staff_user?.full_name?.split(' ')[0];
          const serviceName = readyLine.service_variant?.name || readyLine.service_variant?.service?.name || 'Service';

          if (prevLineDone && stylistFirst) {
            nextUp.push({
              ticketCode: v.ticket_code || 'TKT',
              status: 'next',
              nextDetail: `Next: ${stylistFirst} · ${serviceName}`,
              assignedTo: stylistFirst,
              queuedAt: v.queued_at,
            });
          } else if (stylistFirst) {
            nextUp.push({
              ticketCode: v.ticket_code || 'TKT',
              status: 'next',
              assignedTo: stylistFirst,
              nextDetail: `For ${stylistFirst}`,
              queuedAt: v.queued_at,
            });
          } else {
            nextUp.push({
              ticketCode: v.ticket_code || 'TKT',
              status: 'next',
              assignedTo: 'Available Stylist',
              nextDetail: 'Next available',
              queuedAt: v.queued_at,
            });
          }
        } else {
          // Remaining visits waiting in line
          waitingList.push({
            ticketCode: v.ticket_code || 'TKT',
            status: 'waiting',
            queuedAt: v.queued_at,
          });
        }
      });

      // Simple estimated wait calculation: ~15 mins per waiting client
      const estimatedWaitMinutes = waitingList.length > 0 ? Math.min(60, Math.max(15, waitingList.length * 15)) : 0;

      return ok({
        nowServing,
        nextUp: nextUp.slice(0, 6),
        waitingList,
        estimatedWaitMinutes,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching display board';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async confirmVisit(visitId: string): Promise<Result<{ ticket_code: string }>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client.rpc('confirm_visit', { p_visit_id: visitId });
      if (error) {
        return fail({ code: 'INTERNAL_ERROR', message: error.message });
      }
      if (data && data.error) {
        return fail({ code: 'CONFLICT', message: data.message });
      }
      return ok(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error confirming visit';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async startLine(lineId: string, reason?: string): Promise<Result<{ success: boolean }>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client.rpc('start_service_line', {
        p_visit_service_id: lineId,
        p_reason: reason || null,
      });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (data && data.error) return fail({ code: 'CONFLICT', message: data.message });
      return ok(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error starting service line';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }

  async finishLine(lineId: string): Promise<Result<{ success: boolean; next_line_id?: string }>> {
    try {
      const client = getServiceRoleClient();
      const { data, error } = await client.rpc('finish_service_line', {
        p_visit_service_id: lineId,
      });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (data && data.error) return fail({ code: 'CONFLICT', message: data.message });
      return ok(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error finishing service line';
      return fail({ code: 'INTERNAL_ERROR', message });
    }
  }
}
