import { getAttendanceGateDetailsAction } from '@/modules/day/controllers/attendance.actions';
import { AttendanceGateView } from '@/shared/views/layout/attendance-gate.view';
import { getRoleHome } from '@/shared/models/roles';
import { redirect } from 'next/navigation';

export default async function AttendanceGatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const details = await getAttendanceGateDetailsAction();
  if (!details) redirect('/login');
  if (details.role === 'owner') redirect(getRoleHome(details.role));
  const params = await searchParams;
  const requestedNext = params.next || getRoleHome(details.role);
  const allowedPrefix = `${getRoleHome(details.role)}/`;
  const next = requestedNext === getRoleHome(details.role) || requestedNext.startsWith(allowedPrefix)
    ? requestedNext
    : getRoleHome(details.role);
  return <AttendanceGateView details={details} next={next} />;
}
