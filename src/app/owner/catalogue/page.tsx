import { AppShell } from '@/shared/views/layout/app-shell';
import { SharedCatalogueBoardView } from '@/modules/catalogue';

export const metadata = {
  title: 'Catalogue | Owner Workspace | Mzuri Unisex Salon',
};

export default function OwnerCataloguePage() {
  return (
    <AppShell role="owner" userDisplayName="Godfrey (Owner)" pageTitle="Catalogue">
      <SharedCatalogueBoardView userRole="owner" />
    </AppShell>
  );
}
