import { AppShell } from '@/shared/views/layout/app-shell';
import { HrLeaveView } from '@/modules/people-hr';

export const metadata = {
  title: 'Leave | Mzuri Unisex Salon',
};

export default function LeavePage() {
  return (
    <AppShell role="hr" userDisplayName="Operational User" pageTitle="Leave">
      <HrLeaveView />
    </AppShell>
  );
}
