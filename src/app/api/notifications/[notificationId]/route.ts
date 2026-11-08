import { NextResponse } from 'next/server';
import { getAuthUser } from '@/modules/auth';
import { NotificationRepository } from '@/modules/notifications/models/notification.repository';

const repository = new NotificationRepository();

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in again.' } }, { status: 401 });
  const { notificationId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(notificationId)) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid notification ID.' } }, { status: 400 });
  }
  const result = await repository.markRead(user.id, notificationId);
  return NextResponse.json(result, { status: result.success ? 200 : result.error.code === 'NOT_FOUND' ? 404 : 400 });
}
