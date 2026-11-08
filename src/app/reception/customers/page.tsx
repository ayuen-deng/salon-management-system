import { AppShell } from '@/shared/views/layout/app-shell';
import { ReceptionCustomersView } from '@/modules/reception';

export const metadata = {
  title: 'Customer Directory | Reception Desk | Mzuri Unisex Salon',
};

export default function CustomersPage() {
  return (
    <AppShell role="receptionist" userDisplayName="Mary Namubiru" pageTitle="Customers">
      <ReceptionCustomersView />
    </AppShell>
  );
}
