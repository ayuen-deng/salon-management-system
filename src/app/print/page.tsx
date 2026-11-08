import { PaperFallbackFormsView } from '@/modules/paper-entry';

export const metadata = {
  title: 'Printable Paper Forms | Mzuri Unisex Salon',
};

export default function PrintPage() {
  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <PaperFallbackFormsView />
    </main>
  );
}
