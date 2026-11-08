import { AppShell } from '@/shared/views/layout/app-shell';
import { OwnerCustomersView } from '@/modules/dashboard-owner';

export const metadata = {
  title: 'Customers | Mzuri Unisex Salon',
};

export default function CustomersPage() {
  return (
    <AppShell role="owner" userDisplayName="Godfrey Mugisha" pageTitle="Customers">
      <OwnerCustomersView />
    </AppShell>
  );
}
