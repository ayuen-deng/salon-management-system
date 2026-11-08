import { AppShell } from '@/shared/views/layout/app-shell';
import { OwnerSummariesView } from '@/modules/dashboard-owner';

export const metadata = {
  title: 'Daily summaries | Mzuri Unisex Salon',
};

export default function SummariesPage() {
  return (
    <AppShell role="owner" userDisplayName="Godfrey Mugisha" pageTitle="Daily summaries">
      <OwnerSummariesView />
    </AppShell>
  );
}
