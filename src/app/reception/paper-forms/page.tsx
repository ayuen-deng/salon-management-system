import { AppShell } from '@/shared/views/layout/app-shell';
import { SharedPaperFormsView } from '@/modules/paper-entry';

export const metadata = {
  title: 'Paper Forms & Backup Sheets | Receptionist Workspace | Mzuri Unisex Salon',
};

export default function Page() {
  return (
    <AppShell role="receptionist" userDisplayName="Mary Namubiru" pageTitle="Paper forms">
      <SharedPaperFormsView role="receptionist" />
    </AppShell>
  );
}
