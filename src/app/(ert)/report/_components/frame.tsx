import { figtree, splineSansMono } from '@/components/ds';
import { cn } from '@/lib';
import { TopBar } from './top-bar';

/** Solid white top bar over a light grey page, in Figtree. */
export function ErtFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        figtree.variable,
        splineSansMono.variable,
        'font-landing flex min-h-dvh flex-col bg-gray-50 text-gray-900 antialiased'
      )}
    >
      <TopBar />
      {children}
    </div>
  );
}
