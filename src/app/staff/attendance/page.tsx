import { AppShell } from '@/shared/views/layout/app-shell';
import { StaffAttendanceView } from '@/modules/staff-portal';
import { getAuthUser } from '@/modules/auth';

export const metadata = {
  title: 'My Attendance | Mzuri Unisex Salon',
};

export default async function StaffAttendancePage() {
  const user = await getAuthUser();
  const displayName = user?.displayName || user?.fullName || 'Staff Member';

  return (
    <AppShell role="staff" userDisplayName={displayName} pageTitle="Attendance">
      <StaffAttendanceView />
    </AppShell>
  );
}
