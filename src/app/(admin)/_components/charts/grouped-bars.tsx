'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';

// Building safety charts (DRRM-015). Like summary/charts.tsx, every value is printed and every
// colour has a label, so nothing needs a hover and the chart still reads in black and white.
// Series colours are the --series-N tokens (globals.css), assigned in fixed order.

export const SERIES_COLORS = [1, 2, 3, 4, 5, 6].map((n) => `var(--series-${n})`);

const pctLabel = (v: number | null) => (v === null ? '—' : `${v}%`);

/** Swatch + name per series; clicking one drills into it. */
export function SeriesKey({
  series,
  onSelect,
}: {
  series: { id: string; name: string; color: string }[];
  onSelect?: (id: string) => void;
}) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[14px] font-medium text-gray-700">
      {series.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(s.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md text-left enabled:hover:underline',
              FOCUS_RING
            )}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
            />
            {s.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * One group per metric (Overall, Prevention, …), one bar per series with its % printed above
 * and a thin tick at its previous value. Bars and legend entries call `onSelect`.
 */
export function GroupedBars({
  groups,
  series,
  label,
  onSelect,
}: {
  groups: string[];
  series: {
    id: string;
    name: string;
    color: string;
    values: (number | null)[];
    previous: (number | null)[];
  }[];
  label: string;
  onSelect?: (seriesId: string) => void;
}) {
  return (
    <figure className="flex flex-col gap-3" aria-label={label}>
      {series.length > 1 && <SeriesKey series={series} onSelect={onSelect} />}
      <div className="flex h-48 items-end gap-4 border-b-[1.5px] border-gray-300 pt-5 md:gap-6">
        {groups.map((group, g) => (
          <div key={group} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5">
            {series.map((s) => {
              const value = s.values[g];
              const previous = s.previous[g];
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!onSelect}
                  onClick={() => onSelect?.(s.id)}
                  title={`${s.name}, ${group}: ${pctLabel(value)}${previous !== null ? ` (was ${previous}%)` : ''}`}
                  aria-label={`${s.name}, ${group}: ${pctLabel(value)}${previous !== null ? `, previously ${previous}%` : ''}`}
                  className={cn(
                    'relative h-full max-w-10 min-w-0 flex-1 rounded-t-[4px]',
                    FOCUS_RING
                  )}
                >
                  {/* Above the bar and the tick, whichever is higher, so the tick never crosses it. */}
                  <span
                    className="font-landing-mono absolute inset-x-0 pb-1 text-center text-[11px] leading-none font-semibold text-gray-700"
                    style={{ bottom: `${Math.max(value ?? 0, previous ?? 0)}%` }}
                  >
                    {value === null ? '—' : value}
                  </span>
                  <span
                    className="absolute inset-x-0 bottom-0 rounded-t-[4px]"
                    style={{ height: `${value ?? 0}%`, background: s.color }}
                  />
                  {previous !== null && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 h-0.5 bg-gray-900"
                      style={{ bottom: `${previous}%` }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex gap-4 md:gap-6">
        {groups.map((group) => (
          <span
            key={group}
            className="min-w-0 flex-1 truncate text-center text-[13px] font-medium text-gray-600"
          >
            {group}
          </span>
        ))}
      </div>
      <figcaption className="text-[13px] text-gray-500">
        Bars: latest score. Dark tick: the score before.
      </figcaption>
    </figure>
  );
}
