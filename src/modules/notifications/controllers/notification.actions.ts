'use server';

import { getAuthUser } from '@/modules/auth';
import { NotificationRepository } from '../models/notification.repository';

const repository = new NotificationRepository();

export async function getMyNotificationsAction() {
  const user = await getAuthUser();
  if (!user) return { success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  return repository.getForUser(user.id);
}

export async function markMyNotificationReadAction(notificationId: string) {
  const user = await getAuthUser();
  if (!user) return { success: false as const, error: { code: 'UNAUTHORIZED', message: 'Not authenticated.' } };
  return repository.markRead(user.id, notificationId);
}
