import { AppShell } from '@/shared/views/layout/app-shell';
import { ReceptionClosePrepView } from '@/modules/reception';

export const metadata = {
  title: 'Close Prep | Receptionist Workspace | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="receptionist" userDisplayName="Mary Namubiru" pageTitle="Close prep">
      <ReceptionClosePrepView />
    </AppShell>
  );
}
