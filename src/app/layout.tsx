import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastHost } from '@/shared/views/ui/toast-host';
import { AttendanceProvider } from '@/shared/lib/attendance-context';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Mzuri Unisex Salon | Mbarara',
  description: 'Salon Operations & Management System for Mzuri Unisex Salon, Mbarara.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased bg-[#F6F8FB] text-[#0A0E14] font-sans selection:bg-[#EEF3FF] selection:text-[#1F4FD8]">
        <AttendanceProvider>
          {children}
        </AttendanceProvider>
        <ToastHost />
      </body>
    </html>
  );
}
