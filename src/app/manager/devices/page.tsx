import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerDevicesView } from '@/modules/manager';

export const metadata = {
  title: 'Hardware Devices | Manager Operations | Mzuri Unisex Salon',
};

export default function DevicesPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Devices">
      <ManagerDevicesView />
    </AppShell>
  );
}
