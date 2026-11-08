import { AppShell } from '@/shared/views/layout/app-shell';
import { OwnerWaitsView } from '@/modules/dashboard-owner';

export const metadata = {
  title: 'Waits and services | Mzuri Unisex Salon',
};

export default function WaitsPage() {
  return (
    <AppShell role="owner" userDisplayName="Godfrey Mugisha" pageTitle="Waits and services">
      <OwnerWaitsView />
    </AppShell>
  );
}
