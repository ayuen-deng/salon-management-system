import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerAppointmentsView } from '@/modules/manager';

export const metadata = {
  title: 'Appointments | Manager Operations | Mzuri Unisex Salon',
};

export default function AppointmentsPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Appointments">
      <ManagerAppointmentsView />
    </AppShell>
  );
}
