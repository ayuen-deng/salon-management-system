import { AppShell } from '@/shared/views/layout/app-shell';
import { OwnerVisitsView } from '@/modules/dashboard-owner';

export const metadata = {
  title: 'Visits | Mzuri Unisex Salon',
};

export default function VisitsPage() {
  return (
    <AppShell role="owner" userDisplayName="Godfrey Mugisha" pageTitle="Visits">
      <OwnerVisitsView />
    </AppShell>
  );
}
