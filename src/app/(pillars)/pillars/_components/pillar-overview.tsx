'use client';

import { useScopedCampusId } from '@/app/(admin)/_components/shell/campus-switcher';
import { Card, EmptyNote, Mono } from '@/app/(admin)/_components/ui';
import { FOCUS_RING } from '@/components/ds';
import { usePillarOverview } from '@/components/hooks/use-pillars';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib';
import { percent, type Tally } from '@/lib/assessment-score';
import { RECOVERY_PILLAR } from '@/lib/pillar-metrics';
import { PILLARS, pillarHref } from '@/lib/pillars';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { CampusPicker } from './campus-picker';
import { ScopeNote } from './scope-note';

const pct = (t: Tally | undefined) => {
  if (!t) return '—';
  const p = percent(t);
  return p === null ? '—' : `${p}%`;
};

/** Recovery has one item, so it reads as a count of buildings with the plan. */
function Score({ recovery, tally }: { recovery: boolean; tally: Tally | undefined }) {
  if (!tally) return <Mono>—</Mono>;
  return <Mono>{recovery ? `${tally.safe} of ${tally.counted}` : pct(tally)}</Mono>;
}

/** Executive overview of all four DRRM pillars with rich cards and comparison table. */
export function PillarOverview() {
  const campusId = useScopedCampusId();
  const { data, isPending, error } = usePillarOverview(campusId);

  if (isPending) return <Skeleton className="h-96" />;
  if (error) {
    return (
      <Card className="text-error-700 p-6 text-[16px]">
        The pillars couldn&apos;t be loaded: {error.message}
      </Card>
    );
  }
  if (!data) {
    return (
      <Card className="p-6">
        <EmptyNote>Only administrators can see these results.</EmptyNote>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Controls & Scope Card */}
      <Card className="flex flex-col gap-3 p-4.5 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <ScopeNote />
            <div className="flex flex-wrap items-center gap-3 text-[13px] text-gray-500">
              <span>
                <Mono className="font-bold text-gray-800">{data.assessed.campus}</Mono> campus{' '}
                {data.assessed.campus === 1 ? 'building' : 'buildings'} assessed
              </span>
              <span>·</span>
              <span>
                <Mono className="font-bold text-gray-800">{data.assessed.off_campus}</Mono>{' '}
                off-campus {data.assessed.off_campus === 1 ? 'building' : 'buildings'} assessed
              </span>
            </div>
          </div>
          <CampusPicker />
        </div>
      </Card>

      {/* 4 Pillar Cards Grid */}
      <div className="grid grid-cols-1 gap-4.5 md:grid-cols-2">
        {PILLARS.map((pillar, index) => {
          const row = data.rows.find((r) => r.pillar === pillar.slug);
          const isRecovery = pillar.slug === RECOVERY_PILLAR;
          const campusScorePct = row?.campus ? (percent(row.campus) ?? 0) : 0;
          const offCampusScorePct = row?.off_campus ? (percent(row.off_campus) ?? 0) : 0;

          return (
            <Card
              key={pillar.slug}
              className="group flex flex-col justify-between p-5 transition-all hover:border-gray-300 hover:shadow-md md:p-6"
            >
              <div>
                {/* Header: Badge & Icon */}
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[12px] font-bold tracking-wider text-gray-500 uppercase">
                    Pillar {index + 1} of {PILLARS.length}
                  </span>
                  <span className="bg-brand-25 text-brand-500 grid size-10 place-items-center rounded-xl transition-transform group-hover:scale-105">
                    <pillar.icon size={22} aria-hidden />
                  </span>
                </div>

                {/* Title & Summary */}
                <h2 className="text-[20px] font-bold text-gray-900 leading-snug transition-colors group-hover:text-brand-600">
                  <Link href={pillarHref(pillar.slug)} className={cn('rounded', FOCUS_RING)}>
                    {pillar.name}
                  </Link>
                </h2>
                <p className="mt-2 text-[14px] text-gray-600 leading-relaxed">{pillar.summary}</p>

                {/* Metrics / Scores */}
                <div className="border-line my-4 flex flex-col gap-3 border-t pt-4">
                  {isRecovery ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-semibold text-gray-600">Campus continuity plan</span>
                        <Mono className="font-extrabold text-gray-900">
                          {row?.campus && row.campus.counted > 0
                            ? `${row.campus.safe} of ${row.campus.counted}`
                            : '—'}
                        </Mono>
                      </div>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-semibold text-gray-600">
                          Off-campus continuity plan
                        </span>
                        <Mono className="font-extrabold text-gray-900">
                          {row?.off_campus && row.off_campus.counted > 0
                            ? `${row.off_campus.safe} of ${row.off_campus.counted}`
                            : '—'}
                        </Mono>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="font-semibold text-gray-600">Campus score</span>
                          <Mono className="font-extrabold text-gray-900">{pct(row?.campus)}</Mono>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="bg-brand-solid h-full rounded-full transition-all"
                            style={{ width: `${campusScorePct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="font-semibold text-gray-600">Off-campus score</span>
                          <Mono className="font-extrabold text-gray-900">
                            {pct(row?.off_campus)}
                          </Mono>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-[var(--series-2)] transition-all"
                            style={{ width: `${offCampusScorePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Example focus areas */}
                <div className="mb-4">
                  <span className="text-[12px] font-bold tracking-wider text-gray-400 uppercase">
                    Covers
                  </span>
                  <ul className="mt-1 flex flex-col gap-1 text-[13px] text-gray-500">
                    {pillar.examples.slice(0, 2).map((example) => (
                      <li key={example} className="truncate">
                        · {example}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <Link
                href={pillarHref(pillar.slug)}
                className={cn(
                  'flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 text-[14px] font-semibold text-brand-600 transition-colors group-hover:bg-brand-25',
                  FOCUS_RING
                )}
              >
                <span>View {pillar.label} details</span>
                <ArrowRight
                  size={16}
                  aria-hidden
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
            </Card>
          );
        })}
      </div>

      {/* Comparison Table */}
      <Card className="flex flex-col gap-4 p-4.5 md:p-6">
        <h3 className="text-[18px] font-bold text-gray-900">Pillar comparison table</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-120 text-left text-[15px]">
            <caption className="sr-only">Scores by pillar, campus and off-campus</caption>
            <thead className="border-line border-b text-[12px] font-bold tracking-[.06em] text-gray-500 uppercase">
              <tr>
                <th scope="col" className="py-2.5 pr-3">
                  Pillar
                </th>
                <th scope="col" className="px-2 py-2.5 text-right">
                  Campus ({data.assessed.campus})
                </th>
                <th scope="col" className="py-2.5 pl-2 text-right">
                  Off-campus ({data.assessed.off_campus})
                </th>
              </tr>
            </thead>
            <tbody>
              {PILLARS.map((pillar) => {
                const row = data.rows.find((r) => r.pillar === pillar.slug);
                const recovery = pillar.slug === RECOVERY_PILLAR;
                return (
                  <tr key={pillar.slug} className="border-line border-b last:border-b-0">
                    <th scope="row" className="py-3 pr-3 font-normal">
                      <Link
                        href={pillarHref(pillar.slug)}
                        className={cn(
                          'text-brand-500 rounded font-semibold hover:underline',
                          FOCUS_RING
                        )}
                      >
                        {pillar.name}
                      </Link>
                    </th>
                    <td className="px-2 py-3 text-right">
                      <Score recovery={recovery} tally={row?.campus} />
                    </td>
                    <td className="py-3 pl-2 text-right">
                      <Score recovery={recovery} tally={row?.off_campus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-gray-500">
          The number beside each heading is how many buildings have been assessed. Off-campus scores
          are never counted in campus scores.
        </p>
      </Card>
    </div>
  );
}
