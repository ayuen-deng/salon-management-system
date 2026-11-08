import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerPaymentsView } from '@/modules/manager';

export const metadata = {
  title: 'Payments | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="manager" userDisplayName="Joan Tumusiime" pageTitle="Payments">
      <ManagerPaymentsView />
    </AppShell>
  );
}
