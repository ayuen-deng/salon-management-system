import { NextResponse } from 'next/server';
import { getAuthUser } from '@/modules/auth';
import { NotificationRepository } from '@/modules/notifications/models/notification.repository';

const repository = new NotificationRepository();

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Sign in again.' } }, { status: 401 });
  return NextResponse.json(await repository.getForUser(user.id), { headers: { 'Cache-Control': 'no-store' } });
}
