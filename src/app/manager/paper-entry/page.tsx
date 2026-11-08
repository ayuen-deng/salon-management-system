import { AppShell } from '@/shared/views/layout/app-shell';
import { SharedPaperEntryView } from '@/modules/paper-entry';

export const metadata = {
  title: 'Enter from Paper | Manager Operations | Mzuri Unisex Salon',
};

export default function PaperEntryPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Enter from paper">
      <SharedPaperEntryView role="manager" />
    </AppShell>
  );
}
