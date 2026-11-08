import { AppShell } from '@/shared/views/layout/app-shell';
import { OwnerPaymentsView } from '@/modules/dashboard-owner';

export const metadata = {
  title: 'Payments | Mzuri Unisex Salon',
};

export default function PaymentsPage() {
  return (
    <AppShell role="owner" userDisplayName="Godfrey Mugisha" pageTitle="Payments">
      <OwnerPaymentsView />
    </AppShell>
  );
}
