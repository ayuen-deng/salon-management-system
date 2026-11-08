import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerStaffView } from '@/modules/manager';

export const metadata = {
  title: 'Staff Administration | Manager Operations | Mzuri Unisex Salon',
};

export default function StaffPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Staff">
      <ManagerStaffView />
    </AppShell>
  );
}
