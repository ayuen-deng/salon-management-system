import { AppShell } from '@/shared/views/layout/app-shell';
import { HrAttendanceView } from '@/modules/people-hr';

export const metadata = {
  title: 'Attendance | Mzuri Unisex Salon',
};

export default function AttendancePage() {
  return (
    <AppShell role="hr" userDisplayName="Operational User" pageTitle="Attendance">
      <HrAttendanceView />
    </AppShell>
  );
}
