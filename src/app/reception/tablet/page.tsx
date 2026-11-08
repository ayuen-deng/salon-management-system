import { AppShell } from '@/shared/views/layout/app-shell';
import { ReceptionCustomerTabletView } from '@/modules/reception';

export const metadata = {
  title: 'Customer Tablet | Reception Desk | Mzuri Unisex Salon',
};

export default function CustomerTabletPage() {
  return (
    <AppShell role="receptionist" userDisplayName="Mary Namubiru" pageTitle="Customer tablet">
      <ReceptionCustomerTabletView />
    </AppShell>
  );
}
