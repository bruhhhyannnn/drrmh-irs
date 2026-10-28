import { figtree, RateAppDialog, splineSansMono } from '@/components/ds';
import { cn } from '@/lib';
import { TopBar } from './top-bar';

/**
 * Solid white top bar over a light grey page, in Figtree. Rate the app asks here after a report
 * sends.
 */
export function ErtFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-large-text
      className={cn(
        figtree.variable,
        splineSansMono.variable,
        'font-landing flex min-h-dvh flex-col bg-canvas text-gray-900 antialiased'
      )}
    >
      <TopBar />
      {children}
      <RateAppDialog inAccountMenu />
    </div>
  );
}
