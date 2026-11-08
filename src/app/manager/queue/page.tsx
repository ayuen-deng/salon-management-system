import { AppShell } from '@/shared/views/layout/app-shell';
import { ManagerQueueControlView } from '@/modules/manager';

export const metadata = {
  title: 'Queue control | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="manager" userDisplayName="Joan Tumusiime" pageTitle="Queue control">
      <ManagerQueueControlView />
    </AppShell>
  );
}
