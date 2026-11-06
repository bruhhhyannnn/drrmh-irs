'use client';

import { useScopedCampusId } from '@/app/(admin)/_components/shell/campus-switcher';
import { Card, EmptyNote, Mono } from '@/app/(admin)/_components/ui';
import { pct } from '@/app/(admin)/dashboard/_components/building-safety/parts';
import { FOCUS_RING } from '@/components/ds';
import { usePillarOverview } from '@/components/hooks/use-pillars';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib';
import type { Tally } from '@/lib/assessment-score';
import { RECOVERY_PILLAR } from '@/lib/pillar-metrics';
import { PILLARS, pillarHref } from '@/lib/pillars';
import Link from 'next/link';
import { ScopeNote } from './scope-note';

/** Recovery has one item, so it reads as a count of buildings with the plan. */
function Score({ recovery, tally }: { recovery: boolean; tally: Tally | undefined }) {
  if (!tally) return <Mono>—</Mono>;
  return <Mono>{recovery ? `${tally.safe} of ${tally.counted}` : pct(tally)}</Mono>;
}

/** The four pillars, Campus beside Off-campus. */
export function PillarOverview() {
  const campusId = useScopedCampusId();
  const { data, isPending, error } = usePillarOverview(campusId);

  if (isPending) return <Skeleton className="h-80" />;
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
    <Card className="flex flex-col gap-4 p-4.5 md:p-6">
      <ScopeNote />
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
      <p className="text-[14px] text-gray-600">
        The number beside each heading is how many buildings have been assessed. Off-campus scores
        are never counted in campus scores.
      </p>
    </Card>
  );
}
