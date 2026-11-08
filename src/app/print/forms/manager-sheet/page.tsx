import { Metadata } from 'next';
import { ManagerDaySheetComponent } from '@/modules/paper-entry';

export const metadata: Metadata = {
  title: 'Manager Day Sheet - Print',
};

export default function ManagerSheetPrintPage() {
  return (
    <div className="bg-white min-h-screen p-4 flex flex-col items-center">
      <div className="w-[190mm] min-h-[270mm] print:w-full print:min-h-0">
        <ManagerDaySheetComponent />
      </div>
    </div>
  );
}
