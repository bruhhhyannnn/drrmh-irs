import { cn } from '@/lib';
import type { Metadata } from 'next';
import { figtree, splineSansMono } from '../_components';
import { TopBar } from './_components/chrome';
import { BystanderReportForm } from './bystander-report-form';

export const metadata: Metadata = {
  title: 'Report an emergency | DRRM-H IRS',
};

/** Public bystander report — implements the "DRRM-H Redesign - Bystander" design (light only). */
export default function BystanderReportPage() {
  return (
    <div
      data-large-text
      className={cn(
        figtree.variable,
        splineSansMono.variable,
        'font-landing min-h-screen overflow-x-clip bg-canvas text-gray-900 antialiased'
      )}
    >
      <TopBar />
      <main>
        <BystanderReportForm />
      </main>
    </div>
  );
}
