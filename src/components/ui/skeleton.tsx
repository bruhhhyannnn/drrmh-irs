import { cn } from '@/lib';

/**
 * Placeholder block in the shape of what is loading. Hidden from screen readers: put it in an
 * `aria-busy` region with a visually hidden "Loading…" line. `onDark` is for the maroon heroes.
 */
export function Skeleton({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-xl motion-safe:animate-pulse',
        onDark ? 'bg-white/15' : 'bg-gray-200/70',
        className
      )}
    />
  );
}
