import { AppShell } from '@/shared/views/layout/app-shell';
import { ReceptionVisitsView } from '@/modules/reception';

export const metadata = {
  title: 'Visits | Reception Desk | Mzuri Unisex Salon',
};

export default function ReceptionVisitsPage() {
  return (
    <AppShell role="receptionist" userDisplayName="Mary Namubiru" pageTitle="Visits">
      <ReceptionVisitsView />
    </AppShell>
  );
}
