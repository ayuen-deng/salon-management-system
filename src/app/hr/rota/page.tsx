import { AppShell } from '@/shared/views/layout/app-shell';
import { HrRotaView } from '@/modules/people-hr';

export const metadata = {
  title: 'Rota | Mzuri Unisex Salon',
};

export default function RotaPage() {
  return (
    <AppShell role="hr" userDisplayName="Operational User" pageTitle="Rota">
      <HrRotaView />
    </AppShell>
  );
}
