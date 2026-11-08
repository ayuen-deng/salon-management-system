import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerApprovalsView } from '@/modules/manager';

export const metadata = {
  title: 'Approvals | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="manager" userDisplayName="Joan Tumusiime" pageTitle="Approvals">
      <ManagerApprovalsView />
    </AppShell>
  );
}
