import { AppShell } from '@/shared/views/layout/app-shell';
import { ReceptionAppointmentsView } from '@/modules/reception';

export const metadata = {
  title: 'Appointments Schedule | Reception Desk | Mzuri Unisex Salon',
};

export default function AppointmentsPage() {
  return (
    <AppShell role="receptionist" userDisplayName="Mary Namubiru" pageTitle="Appointments">
      <ReceptionAppointmentsView />
    </AppShell>
  );
}
