import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerReconciliationView } from '@/modules/manager';

export const metadata = {
  title: 'Reconciliation | Manager Operations | Mzuri Unisex Salon',
};

export default function ReconciliationPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Reconciliation">
      <ManagerReconciliationView />
    </AppShell>
  );
}
