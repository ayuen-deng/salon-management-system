import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerPortalView } from '@/modules/manager';

export const metadata = {
  title: 'Manager Operations | Mzuri Unisex Salon',
};

export default function ManagerPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan Tumusiime" pageTitle="Manager Operations">
      <ManagerPortalView />
    </AppShell>
  );
}
