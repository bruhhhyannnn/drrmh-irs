import { Providers } from '@/components/providers';
import { THEME_SCRIPT } from '@/lib/theme';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'IRS | DRRM-H',
  description:
    'UP Manila Disaster Risk Reduction Management in Health Program - Incident Reporting System',
  // The tab icon and the iPhone home-screen icon come from src/app/favicon.ico, icon.png and
  // apple-icon.png, which Next.js links on its own.
  manifest: '/manifest.json',
  appleWebApp: { title: 'IRS', capable: true },
};

export const viewport: Viewport = {
  // The installed app's title bar follows the device theme: white, or the dark canvas.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c111d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Applies the saved light / dark theme before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
