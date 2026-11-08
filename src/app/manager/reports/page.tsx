import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerReportsView } from '@/modules/manager';

export const metadata = {
  title: 'Reports & Analytics | Manager Operations | Mzuri Unisex Salon',
};

export default function ReportsPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Reports">
      <ManagerReportsView />
    </AppShell>
  );
}
