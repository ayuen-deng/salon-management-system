import { AppShell } from '@/shared/views/layout/app-shell';
import { OwnerAuditView } from '@/modules/dashboard-owner';

export const metadata = {
  title: 'Audit log | Mzuri Unisex Salon',
};

export default function AuditPage() {
  return (
    <AppShell role="owner" userDisplayName="Godfrey Mugisha" pageTitle="Audit log">
      <OwnerAuditView />
    </AppShell>
  );
}
