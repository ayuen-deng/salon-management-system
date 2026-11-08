import { AppShell } from '@/shared/views/layout/app-shell';
import { SharedPaperFormsView } from '@/modules/paper-entry';

export const metadata = {
  title: 'Paper Forms & Backup Sheets | Manager Operations | Mzuri Unisex Salon',
};

export default function PaperFormsPage() {
  return (
    <AppShell role="manager" userDisplayName="Joan (Manager)" pageTitle="Paper forms">
      <SharedPaperFormsView role="manager" />
    </AppShell>
  );
}
