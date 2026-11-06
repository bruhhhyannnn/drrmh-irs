'use client';

import { Card, EmptyNote, Mono } from '@/app/(admin)/_components/ui';
import { percent } from '@/lib/assessment-score';
import type { BuildingCategory } from '@/lib/building-place';
import type { ScoredView } from '@/lib/pillar-metrics';
import { BuildingLink, formatShortDate, NONE, pct } from './shared';

export function BuildingsToVisit({
  category,
  group,
}: {
  category: BuildingCategory;
  group: ScoredView;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4.5 md:p-6">
      <div>
        <h2 className="text-[19px] font-bold">3. Buildings to visit</h2>
        <p className="text-[13px] text-gray-500">
          Lowest-scoring first. Each opens the building&apos;s assessments.
        </p>
      </div>

      {group.assessed === 0 ? (
        <EmptyNote>{NONE[category]}</EmptyNote>
      ) : group.lowest.length === 0 ? (
        <EmptyNote>No scored buildings recorded in this pillar.</EmptyNote>
      ) : (
        <ul className="flex flex-col">
          {group.lowest.map((b) => {
            const scorePct = percent(b.tally) ?? 0;
            return (
              <li
                key={b.id}
                className="border-line flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <BuildingLink id={b.id} name={b.name} label={b.label} category={b.category} />
                  {b.needs_follow_up && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                      Follow-up
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="flex w-36 flex-col items-end gap-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="bg-brand-solid h-full rounded-full transition-all"
                        style={{ width: `${scorePct}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-gray-500">
                      <Mono className="font-bold text-gray-900">{pct(b.tally)}</Mono>
                      {b.ended_at && <span> · assessed {formatShortDate(b.ended_at)}</span>}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
