import { AppShell } from '@/shared/views/layout/app-shell';
import { NeutralPlaceholderView } from '@/shared/views/ui/neutral-placeholder.view';

export const metadata = {
  title: 'Day Close | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="manager" userDisplayName="Operational User" pageTitle="Day Close">
      <NeutralPlaceholderView title="Day Close" role="manager" />
    </AppShell>
  );
}
