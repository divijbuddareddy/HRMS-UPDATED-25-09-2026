import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { TopProgressBar } from '@/components/TopProgressBar';

export const metadata: Metadata = {
  title: 'AI Automation Labs HRMS — Core HR & Payroll',
  description: 'India-first, multi-tenant enterprise HRMS platform with core HR, attendance, leave ledger and statutory payroll.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <TopProgressBar />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
