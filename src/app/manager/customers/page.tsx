import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerCustomersView } from '@/modules/manager';

export const metadata = {
  title: 'Customers Directory | Manager Operations | Mzuri Unisex Salon',
};

export default function CustomersPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Customers">
      <ManagerCustomersView />
    </AppShell>
  );
}
