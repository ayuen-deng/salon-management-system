import { AppShell } from '@/shared/views/layout/app-shell';
import { HrPerformanceView } from '@/modules/people-hr';

export const metadata = {
  title: 'Performance | Mzuri Unisex Salon',
};

export default function PerformancePage() {
  return (
    <AppShell role="hr" userDisplayName="Operational User" pageTitle="Performance">
      <HrPerformanceView />
    </AppShell>
  );
}
