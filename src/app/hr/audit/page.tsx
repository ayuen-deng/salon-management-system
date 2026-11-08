import { AppShell } from '@/shared/views/layout/app-shell';
import { HrAuditView } from '@/modules/people-hr';

export const metadata = {
  title: 'Audit | Mzuri Unisex Salon',
};

export default function AuditPage() {
  return (
    <AppShell role="hr" userDisplayName="Operational User" pageTitle="Audit">
      <HrAuditView />
    </AppShell>
  );
}
