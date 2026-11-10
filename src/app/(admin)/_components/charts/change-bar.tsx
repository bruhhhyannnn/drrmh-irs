'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';

// Re-assessed buildings, worse / same / better (DRRM-027): one bar split by count, a warm and a
// cool hue with gray in the middle, each part named in words as well as colored.

export type ChangeKind = 'worse' | 'same' | 'better';

const STYLE: Record<ChangeKind, string> = {
  worse: 'bg-brand-600',
  same: 'bg-gray-300',
  better: 'bg-[var(--series-1)]',
};

export function ChangeBar({
  counts,
  words,
  selected,
  onSelect,
}: {
  counts: Record<ChangeKind, number>;
  /** "worse" / "lost a plan", and so on. */
  words: Record<ChangeKind, string>;
  selected?: ChangeKind | null;
  onSelect: (kind: ChangeKind) => void;
}) {
  const kinds: ChangeKind[] = ['worse', 'same', 'better'];
  const total = kinds.reduce((n, k) => n + counts[k], 0);
  if (total === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-7 gap-0.5 overflow-hidden rounded-[6px]" aria-hidden>
        {kinds
          .filter((k) => counts[k] > 0)
          .map((k) => (
            <span
              key={k}
              className={STYLE[k]}
              style={{ flexGrow: counts[k] }}
              title={`${counts[k]} ${words[k]}`}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Re-assessed buildings">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onSelect(k)}
            aria-pressed={selected === k}
            disabled={counts[k] === 0}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[14px] disabled:opacity-50',
              selected === k ? 'border-gray-900 font-bold' : 'border-gray-200',
              FOCUS_RING
            )}
          >
            <span aria-hidden className={cn('size-2.5 rounded-full', STYLE[k])} />
            <span className="font-landing-mono font-bold">{counts[k]}</span> {words[k]}
          </button>
        ))}
      </div>
    </div>
  );
}
