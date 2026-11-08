import { AppShell } from '@/shared/views/layout/app-shell';
import { SharedCatalogueBoardView } from '@/modules/catalogue';

export const metadata = {
  title: 'Catalogue and prices | Manager Operations | Mzuri Unisex Salon',
};

export default function ManagerCataloguePage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Catalogue and prices">
      <SharedCatalogueBoardView userRole="manager" />
    </AppShell>
  );
}
