'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';

// Buildings by score band (DRRM-027): one maroon ramp, darkest for the lowest band, because that
// is the one to act on. Every count is printed, and each bar is a button that lists its buildings.

const RAMP = ['bg-brand-800', 'bg-brand-600', 'bg-brand-400', 'bg-brand-200'];

export function BandBars({
  bands,
  selected,
  onSelect,
}: {
  bands: { band: string; label: string; count: number }[];
  selected?: string | null;
  onSelect: (band: string) => void;
}) {
  const max = Math.max(1, ...bands.map((b) => b.count));
  return (
    <div className="grid grid-cols-4 items-end gap-3" role="group" aria-label="Buildings by score">
      {bands.map((b, i) => {
        const on = selected === b.band;
        return (
          <button
            key={b.band}
            type="button"
            onClick={() => onSelect(b.band)}
            aria-pressed={on}
            aria-label={`${b.label}: ${b.count} ${b.count === 1 ? 'building' : 'buildings'}`}
            title={`${b.label}: ${b.count}`}
            className={cn('group flex flex-col items-center gap-1.5 rounded-xl p-1', FOCUS_RING)}
          >
            <span className="font-landing-mono text-[15px] font-bold text-gray-900">{b.count}</span>
            <span className="flex h-28 w-full items-end">
              <span
                className={cn(
                  'w-full rounded-t-[4px] transition-opacity group-hover:opacity-85',
                  RAMP[i],
                  on && 'ring-2 ring-gray-900 ring-offset-2 ring-offset-surface'
                )}
                style={{ height: `${Math.max(b.count ? 6 : 2, (b.count / max) * 100)}%` }}
              />
            </span>
            <span className={cn('text-[13px] text-gray-600', on && 'font-bold text-gray-900')}>
              {b.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
