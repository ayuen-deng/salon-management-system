import { AppShell } from '@/shared/views/layout/app-shell';
import { SharedPaperEntryView } from '@/modules/paper-entry';

export const metadata = {
  title: 'Enter from Paper | Receptionist Workspace | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="receptionist" userDisplayName="Mary Namubiru" pageTitle="Enter from paper">
      <SharedPaperEntryView role="receptionist" />
    </AppShell>
  );
}
