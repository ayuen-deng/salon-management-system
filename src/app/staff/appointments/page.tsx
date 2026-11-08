import { AppShell } from '@/shared/views/layout/app-shell';
import { StaffAppointmentsView } from '@/modules/staff-portal';
import { getAuthUser } from '@/modules/auth';

export const metadata = {
  title: 'Assigned Appointments | Mzuri Unisex Salon',
};

export default async function StaffAppointmentsPage() {
  const user = await getAuthUser();
  const displayName = user?.displayName || user?.fullName || 'Staff Member';

  return (
    <AppShell role="staff" userDisplayName={displayName} pageTitle="Appointments">
      <StaffAppointmentsView />
    </AppShell>
  );
}
