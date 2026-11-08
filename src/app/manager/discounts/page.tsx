import { AppShell } from '@/shared/views/layout/app-shell';
import { NeutralPlaceholderView } from '@/shared/views/ui/neutral-placeholder.view';

export const metadata = {
  title: 'Discount Settings | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="manager" userDisplayName="Operational User" pageTitle="Discount Settings">
      <NeutralPlaceholderView title="Discount Settings" role="manager" />
    </AppShell>
  );
}
