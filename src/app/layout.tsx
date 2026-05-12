import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const outfit = Outfit({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DRRM-H - IRS',
  description:
    'UP Manila Disaster Risk Reduction Management in Health Program - Incident Reporting System',
  icons: {
    icon: '/irs-favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.className} `} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
