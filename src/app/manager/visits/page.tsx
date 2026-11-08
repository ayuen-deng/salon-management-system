import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerVisitsView } from '@/modules/manager';

export const metadata = {
  title: 'Visits | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="manager" userDisplayName="Joan Tumusiime" pageTitle="Visits">
      <ManagerVisitsView />
    </AppShell>
  );
}
