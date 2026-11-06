'use client';

// Assessments per month (DRRM-027): one series in the brand color. Counts above the bars that have
// any, and every month named under its bar, so nothing needs hovering to read.

export function ActivityBars({ months }: { months: { label: string; count: number }[] }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  return (
    <figure className="flex flex-col gap-2">
      <div
        className="grid items-end gap-1.5"
        style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
      >
        {months.map((m, i) => (
          <div
            key={`${m.label}-${i}`}
            className="flex flex-col items-center gap-1"
            title={`${m.label}: ${m.count}`}
          >
            <span className="font-landing-mono h-4 text-[12px] font-bold text-gray-900">
              {m.count > 0 ? m.count : ''}
            </span>
            <span className="flex h-24 w-full items-end">
              <span
                className="bg-brand-solid w-full rounded-t-[4px]"
                style={{ height: `${m.count ? Math.max(6, (m.count / max) * 100) : 2}%` }}
              />
            </span>
            <span className="text-[11px] text-gray-500">{m.label}</span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">
        Assessments per month: {months.map((m) => `${m.label} ${m.count}`).join(', ')}
      </figcaption>
    </figure>
  );
}
