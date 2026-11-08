import { AppShell } from '@/shared/views/layout/app-shell';
import { HrOverviewView } from '@/modules/people-hr';

export const metadata = {
  title: 'HR Overview | Mzuri Unisex Salon',
};

export default function HrOverviewPage() {
  return (
    <AppShell role="hr" pageTitle="HR Overview">
      <HrOverviewView />
    </AppShell>
  );
}
