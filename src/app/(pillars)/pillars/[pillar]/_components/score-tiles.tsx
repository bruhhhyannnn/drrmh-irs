'use client';

import { ChangeBadge } from '@/app/(admin)/_components/charts/change-badge';
import { Card, EmptyNote, Mono } from '@/app/(admin)/_components/ui';
import type { BuildingCategory } from '@/lib/building-place';
import type { ScoredView } from '@/lib/pillar-metrics';
import { asPercent, NONE, pct } from './shared';

export function ScoreTiles({
  pillarName,
  category,
  group,
}: {
  pillarName: string;
  category: BuildingCategory;
  group: ScoredView;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4.5 md:p-6">
      <div>
        <h2 className="text-[19px] font-bold">1. How are we doing?</h2>
        <p className="text-[13px] text-gray-500">
          Latest assessment of each building. ▲ is the change since each building&apos;s previous
          one.
        </p>
      </div>

      {group.assessed === 0 ? (
        <EmptyNote>{NONE[category]}</EmptyNote>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="border-line bg-surface flex flex-col gap-1 rounded-[16px] border p-3.5">
            <span className="text-[13px] font-semibold text-gray-500">{pillarName} score</span>
            <div className="flex flex-wrap items-baseline gap-2">
              <Mono className="text-[24px] font-extrabold text-gray-900 md:text-[28px]">
                {pct(group.tally)}
              </Mono>
              {group.change !== null && (
                <span className="flex items-baseline gap-1">
                  <ChangeBadge value={group.change} className="text-[13px]" />
                  <span className="text-[12px] text-gray-500">pts</span>
                </span>
              )}
            </div>
          </div>

          <div className="border-line bg-surface flex flex-col gap-1 rounded-[16px] border p-3.5">
            <span className="text-[13px] font-semibold text-gray-500">Buildings assessed</span>
            <Mono className="text-[24px] font-extrabold text-gray-900 md:text-[28px]">
              {group.assessed}
            </Mono>
            <span className="text-[12px] text-gray-500">{group.reassessed} re-assessed</span>
          </div>

          <div className="border-line bg-surface flex flex-col gap-1 rounded-[16px] border p-3.5">
            <span className="text-[13px] font-semibold text-gray-500">Need follow-up</span>
            <Mono className="text-[24px] font-extrabold text-gray-900 md:text-[28px]">
              {group.needsFollowUp}
            </Mono>
            <span className="text-[12px] text-gray-500">flagged by checklist</span>
          </div>

          <div className="border-line bg-surface flex flex-col gap-1 rounded-[16px] border p-3.5">
            <span className="text-[13px] font-semibold text-gray-500">Answered N/A</span>
            <Mono className="text-[24px] font-extrabold text-gray-900 md:text-[28px]">
              {asPercent(group.naRate)}
            </Mono>
            <span className="text-[12px] text-gray-500">of all answers</span>
          </div>
        </div>
      )}
    </Card>
  );
}
