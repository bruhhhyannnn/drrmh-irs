import { cn } from '@/lib';
import type { CountRow, Level } from '../../_lib/summary';
import { Chip, Mono } from '../ui';

// Charts print their values, and every colour has a label, so nothing needs a hover and the
// report still reads in black and white.

export const SERIES = { a: '#a11d1d', b: '#98a2b3' };

/** Two-series legend: Q4 2026 ■  Q3 2026 ■ */
export function SeriesLegend({ a, b }: { a: string; b: string }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] font-medium text-gray-600">
      {[
        [a, SERIES.a],
        [b, SERIES.b],
      ].map(([label, color]) => (
        <span key={label + color} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-[3px]"
            style={{ background: color }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

/** Vertical bars with the count printed above each, and the bin labels under. */
export function ColumnChart({
  labels,
  series,
  max,
  label,
}: {
  labels: string[];
  /** One or two series of counts, aligned with `labels`. */
  series: { values: number[]; color: string }[];
  max?: number;
  label: string;
}) {
  const top = Math.max(1, max ?? Math.max(0, ...series.flatMap((s) => s.values)));
  const paired = series.length > 1;
  return (
    <figure className="flex flex-col gap-2" aria-label={label}>
      <div
        className={cn(
          'flex h-42 items-end border-b-[1.5px] border-gray-300',
          paired ? 'gap-3' : 'gap-2.5'
        )}
      >
        {labels.map((bin, i) => (
          <div
            key={bin + i}
            className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.75"
            role="img"
            aria-label={`${bin}: ${series.map((s) => s.values[i]).join(' and ')}`}
          >
            {series.map((s, si) => (
              <div
                key={si}
                className={cn(
                  'flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1',
                  paired ? 'max-w-5.5' : 'max-w-12'
                )}
              >
                <span
                  className={cn(
                    'font-landing-mono text-[12px] font-bold',
                    si === 0 ? 'text-gray-900' : 'font-semibold text-gray-500'
                  )}
                >
                  {s.values[i]}
                </span>
                <div
                  className="min-h-0.5 w-full rounded-[6px_6px_2px_2px]"
                  style={{ height: `${(s.values[i] / top) * 80}%`, background: s.color }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className={cn('flex', paired ? 'gap-3' : 'gap-2.5')} aria-hidden>
        {labels.map((bin, i) => (
          <span
            key={bin + i}
            className="font-landing-mono min-w-0 flex-1 text-center text-[12px] font-medium text-gray-500"
          >
            {bin}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Ranked horizontal bars: name | bar | value (and a second series under it when paired). */
export function RankedBars({
  rows,
  max,
  nameWidth = 'w-24',
  valueWidth = 'w-18',
  axis,
  compact = false,
}: {
  rows: {
    key: string;
    name: string;
    values: { value: number | null; label: string; color: string; muted?: boolean }[];
  }[];
  max: number;
  nameWidth?: string;
  valueWidth?: string;
  /** Tick labels under the bars, e.g. 0 15 30 45 60 with a "min" unit. */
  axis?: { ticks: number[]; unit: string };
  /** Paired values side by side instead of stacked, for the report PDF. */
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3')}>
      {rows.map((row) => (
        <div key={row.key} className={cn('flex items-center', compact ? 'gap-2' : 'gap-3')}>
          <span
            className={cn(
              'shrink-0 text-[13px] leading-[1.3] font-semibold text-pretty text-gray-700',
              nameWidth
            )}
          >
            {row.name}
          </span>
          <div className={cn('flex min-w-0 flex-1 flex-col', compact ? 'gap-0.5' : 'gap-1')}>
            {row.values.map((v, i) => (
              <div
                key={i}
                className={cn(
                  'overflow-hidden rounded-full bg-gray-100',
                  row.values.length > 1 ? (compact ? 'h-1.5' : 'h-2') : 'h-2.5'
                )}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${v.value ? Math.min(100, (v.value / max) * 100) : 0}%`,
                    background: v.color,
                  }}
                />
              </div>
            ))}
          </div>
          <div
            className={cn(
              'flex shrink-0 items-end',
              compact ? 'flex-row justify-end gap-2' : 'flex-col gap-px',
              valueWidth
            )}
          >
            {row.values.map((v, i) => (
              <Mono
                key={i}
                className={cn(
                  'text-right',
                  i === 0 ? 'text-[13px] font-semibold' : 'text-[12px] font-medium text-gray-500',
                  i === 0 && (v.muted ? 'text-gray-400' : 'text-gray-900')
                )}
              >
                {v.label}
              </Mono>
            ))}
          </div>
        </div>
      ))}
      {axis && (
        <div className="-mt-1 flex items-center gap-3" aria-hidden>
          <span className={cn('shrink-0', nameWidth)} />
          <div className="font-landing-mono flex min-w-0 flex-1 justify-between text-[11px] font-medium text-gray-400">
            {axis.ticks.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <span
            className={cn(
              'font-landing-mono shrink-0 text-right text-[11px] font-medium text-gray-400',
              valueWidth
            )}
          >
            {axis.unit}
          </span>
        </div>
      )}
    </div>
  );
}

/** Donut with the total in the middle and a legend with counts and shares. */
export function Donut({
  rows,
  total,
  unit,
  compact = false,
}: {
  rows: CountRow[];
  total: number;
  unit: string;
  /** Smaller, so it stays beside its legend in a narrow card (the report PDF). */
  compact?: boolean;
}) {
  let acc = 0;
  const stops = rows
    .filter((r) => r.count > 0)
    .map((r) => {
      const from = acc;
      acc += (r.count / Math.max(1, total)) * 100;
      return `${r.color} ${from}% ${acc}%`;
    });
  const background = stops.length ? `conic-gradient(${stops.join(', ')})` : '#f2f4f7';
  return (
    <div className={cn('flex flex-wrap items-center gap-y-5', compact ? 'gap-x-5' : 'gap-x-7')}>
      <div
        aria-hidden
        className={cn(
          'relative shrink-0 rounded-full print:[print-color-adjust:exact]',
          compact ? 'size-28' : 'size-39'
        )}
        style={{ background }}
      >
        <div
          className={cn(
            'absolute flex flex-col items-center justify-center gap-0.5 rounded-full bg-white',
            compact ? 'inset-4.5' : 'inset-6'
          )}
        >
          <Mono
            className={cn('leading-none font-extrabold', compact ? 'text-[24px]' : 'text-[30px]')}
          >
            {total}
          </Mono>
          <span className="text-[12px] font-medium text-gray-500">{unit}</span>
        </div>
      </div>
      <ul
        className={cn('flex min-w-0 flex-col', compact ? 'flex-[1_1_140px]' : 'flex-[1_1_180px]')}
      >
        {rows.map((r) => (
          <li
            key={r.name}
            className={cn(
              'flex items-center gap-2.5 border-b border-[#eaecf0]',
              compact ? 'py-1.5' : 'py-2.5'
            )}
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: r.color }}
            />
            <span className="min-w-0 flex-1 text-[14px] font-medium text-gray-700">{r.name}</span>
            <Mono
              className={cn(
                'text-[14px] font-semibold',
                r.count ? 'text-gray-900' : 'text-gray-400'
              )}
            >
              {r.count}
            </Mono>
            <Mono className="w-10 text-right text-[13px] font-medium text-gray-500">
              {total ? `${Math.round((r.count / total) * 100)}%` : '0%'}
            </Mono>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Split bar of every unit's damage, a two-column legend, and the units with damage. */
export function DamageChart({
  rows,
  withDamage,
}: {
  rows: CountRow[];
  withDamage: { id: string; unit: string; cluster: string; condition: string; level: Level }[];
}) {
  const filled = rows.filter((r) => r.count > 0);
  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex flex-col gap-3">
        <div aria-hidden className="flex h-3.5 gap-0.75 overflow-hidden rounded-full bg-gray-100">
          {filled.map((r) => (
            <div key={r.name} style={{ flexGrow: r.count, flexBasis: 0, background: r.color }} />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-x-5">
          {rows.map((r) => (
            <li key={r.name} className="flex min-w-0 items-center gap-2 py-1.75">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: r.color }}
              />
              <span className="min-w-0 flex-1 text-[13px] font-medium text-gray-700">{r.name}</span>
              <Mono
                className={cn(
                  'text-[13px] font-semibold',
                  r.count ? 'text-gray-900' : 'text-gray-400'
                )}
              >
                {r.count}
              </Mono>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col">
        <span className="pb-1 text-[11px] font-bold tracking-[.08em] text-gray-500 uppercase">
          Units with damage · {withDamage.length}
        </span>
        {withDamage.length ? (
          <ul>
            {withDamage.map((d) => (
              <li key={d.id} className="flex items-center gap-3 border-b border-[#eaecf0] py-2.5">
                <div className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="text-[14px] font-semibold">{d.unit}</span>
                  <span className="text-[13px] text-gray-500">{d.cluster}</span>
                </div>
                <Chip tone={d.level.tone}>{d.condition}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-2.5 text-[13px] text-gray-500">No unit reported damage.</p>
        )}
      </div>
    </div>
  );
}
