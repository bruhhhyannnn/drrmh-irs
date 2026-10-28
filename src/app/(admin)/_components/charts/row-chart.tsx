'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';

/**
 * One row per child, lowest first (nothing counted last, as "—"): the latest score as a bar with
 * its value printed, and a dark tick at the score before. For more children than grouped bars
 * can show; one metric at a time.
 */
export function RowChart({
  rows,
  label,
  onSelect,
}: {
  rows: { id: string; name: string; value: number | null; previous: number | null }[];
  label: string;
  onSelect?: (id: string) => void;
}) {
  const sorted = [...rows].sort((a, b) => {
    if (a.value === null) return b.value === null ? a.name.localeCompare(b.name) : 1;
    if (b.value === null) return -1;
    return a.value - b.value || a.name.localeCompare(b.name);
  });
  return (
    <figure className="flex flex-col gap-1" aria-label={label}>
      <ul className="flex flex-col">
        {sorted.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(row.id)}
              className={cn(
                'grid w-full grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-3 rounded-lg py-1.5 text-left enabled:hover:bg-gray-50 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_3.5rem]',
                FOCUS_RING
              )}
            >
              <span className="truncate text-[14px] font-medium text-gray-700">{row.name}</span>
              <span className="relative h-3 rounded-full bg-gray-100">
                <span
                  className="bg-brand-500 absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${row.value ?? 0}%` }}
                />
                {row.previous !== null && (
                  <span
                    aria-hidden
                    className="absolute -inset-y-1 w-0.5 bg-gray-900"
                    style={{ left: `${row.previous}%` }}
                  />
                )}
              </span>
              <span className="font-landing-mono text-right text-[14px] font-semibold text-gray-900">
                {row.value === null ? '—' : `${row.value}%`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <figcaption className="text-[13px] text-gray-500">
        Bars: latest score, lowest first. Dark tick: the score before.
      </figcaption>
    </figure>
  );
}
