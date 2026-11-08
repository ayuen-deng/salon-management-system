import { getServiceRoleClient } from '@/shared/lib/supabase';
import { fail, ok, type Result } from '@/shared/models/result';

export interface AppNotification {
  id: string;
  notification_kind: string;
  title: string;
  body: string;
  link: string | null;
  created_at: string;
  read_at: string | null;
}

export interface MyNotifications {
  userId: string;
  items: AppNotification[];
}

export class NotificationRepository {
  async getForUser(userId: string): Promise<Result<MyNotifications>> {
    try {
      const { data, error } = await getServiceRoleClient()
        .from('notification')
        .select('id,notification_kind,title,body,link,created_at,read_at')
        .eq('channel', 'in_app')
        .eq('recipient_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      return ok({ userId, items: (data || []) as AppNotification[] });
    } catch (error) {
      return fail({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Could not load notifications.' });
    }
  }

  async markRead(userId: string, notificationId: string): Promise<Result<{ success: true }>> {
    try {
      const { data, error } = await getServiceRoleClient().rpc('mark_my_notification_read', { p_user_id: userId, p_notification_id: notificationId });
      if (error) return fail({ code: 'INTERNAL_ERROR', message: error.message });
      if (!data) return fail({ code: 'NOT_FOUND', message: 'Unread notification not found.' });
      return ok({ success: true });
    } catch (error) {
      return fail({ code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Could not update notification.' });
    }
  }
}
