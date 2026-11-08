import { Metadata } from 'next';
import { CashCountSheetComponent } from '@/modules/paper-entry';

export const metadata: Metadata = {
  title: 'End of Day Cash Count Sheet - Print',
};

export default function CashCountSheetPrintPage() {
  return (
    <div className="bg-white min-h-screen p-4 flex flex-col items-center">
      <div className="w-[190mm] min-h-[270mm] print:w-full print:min-h-0">
        <CashCountSheetComponent />
      </div>
    </div>
  );
}
