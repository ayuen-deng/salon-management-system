import { redirect } from 'next/navigation';
import { AppShell } from '@/shared/views/layout/app-shell';
import { StaffLeaveView } from '@/modules/staff-portal';
import { getAuthUser } from '@/modules/auth';

export const metadata = { title: 'My Leave | Mzuri Unisex Salon' };

export default async function StaffLeavePage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');
  if (user.role !== 'staff') redirect(`/${user.role === 'owner' ? 'owner' : user.role === 'hr' ? 'hr' : user.role === 'manager' ? 'manager' : 'reception'}`);
  const name = user.displayName || user.fullName || 'Staff Member';
  return <AppShell role="staff" userDisplayName={name} pageTitle="Leave"><StaffLeaveView /></AppShell>;
}
