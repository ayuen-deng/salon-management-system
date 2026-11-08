import { AppShell } from '@/shared/views/layout/app-shell';
import { OwnerDashboardView } from '@/modules/dashboard-owner';

export const metadata = {
  title: 'Owner Monitor (Kampala) | Mzuri Unisex Salon',
};

export default function OwnerPage() {
  return (
    <AppShell role="owner" userDisplayName="Godfrey Mugisha" pageTitle="Dashboard">
      <OwnerDashboardView />
    </AppShell>
  );
}
