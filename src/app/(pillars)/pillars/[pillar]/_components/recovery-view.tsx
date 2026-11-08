'use client';

import { ChangeBadge } from '@/app/(admin)/_components/charts/change-badge';
import { Card, EmptyNote, Mono } from '@/app/(admin)/_components/ui';
import type { BuildingCategory } from '@/lib/building-place';
import type { RecoveryView } from '@/lib/pillar-metrics';
import { TrendsSection } from './pillar-charts';
import { BuildingLink, NONE } from './shared';

export function RecoveryViewSection({
  pillarName,
  category,
  group,
  campusTrend,
  offCampusTrend,
}: {
  pillarName: string;
  category: BuildingCategory;
  group: RecoveryView;
  campusTrend: RecoveryView['trend'];
  offCampusTrend: RecoveryView['trend'];
}) {
  const total = group.in_place + group.missing + group.na;
  const reassessed =
    group.changes.worse.length + group.changes.same.length + group.changes.better.length;

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Continuity plan status */}
      <Card className="flex flex-col gap-3 p-4.5 md:p-6">
        <div>
          <h2 className="text-[19px] font-bold">1. Public Service Continuity Plan</h2>
          <p className="text-[13px] text-gray-500">
            Latest assessment of each building for continuity plan readiness.
          </p>
        </div>

        {total === 0 ? (
          <EmptyNote>{NONE[category]}</EmptyNote>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <div className="border-line bg-surface flex flex-col gap-1 rounded-[16px] border p-3.5">
              <span className="text-[13px] font-semibold text-gray-500">In place</span>
              <Mono className="text-[24px] font-extrabold text-success-700 md:text-[28px]">
                {group.in_place}
              </Mono>
            </div>
            <div className="border-line bg-surface flex flex-col gap-1 rounded-[16px] border p-3.5">
              <span className="text-[13px] font-semibold text-gray-500">Missing</span>
              <Mono className="text-[24px] font-extrabold text-error-700 md:text-[28px]">
                {group.missing}
              </Mono>
            </div>
            <div className="border-line bg-surface flex flex-col gap-1 rounded-[16px] border p-3.5">
              <span className="text-[13px] font-semibold text-gray-500">N/A</span>
              <Mono className="text-[24px] font-extrabold text-gray-700 md:text-[28px]">
                {group.na}
              </Mono>
            </div>
          </div>
        )}
      </Card>

      {/* 2. Buildings with no plan */}
      <Card className="flex flex-col gap-3 p-4.5 md:p-6">
        <div>
          <h2 className="text-[19px] font-bold">2. Buildings with no plan</h2>
          <p className="text-[13px] text-gray-500">
            Buildings assessed without a continuity plan in place.
          </p>
        </div>

        {total === 0 ? (
          <EmptyNote>{NONE[category]}</EmptyNote>
        ) : group.missingBuildings.length === 0 ? (
          <EmptyNote>All assessed buildings have a continuity plan in place.</EmptyNote>
        ) : (
          <ul className="flex flex-col">
            {group.missingBuildings.map((b) => (
              <li
                key={b.id}
                className="border-line flex items-center justify-between border-b py-2.5 last:border-b-0"
              >
                <BuildingLink id={b.id} name={b.name} label={b.label} category={b.category} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 3. By place */}
      <Card className="flex flex-col gap-3 p-4.5 md:p-6">
        <div>
          <h2 className="text-[19px] font-bold">3. Continuity plans by place</h2>
          <p className="text-[13px] text-gray-500">
            Campuses, clusters, or locations with plans in place.
          </p>
        </div>

        {total === 0 ? (
          <EmptyNote>{NONE[category]}</EmptyNote>
        ) : group.places.length === 0 ? (
          <EmptyNote>No places recorded.</EmptyNote>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">Continuity plan status by place</caption>
              <thead className="border-line border-b text-[12px] font-bold tracking-wider text-gray-500 uppercase">
                <tr>
                  <th scope="col" className="py-2.5 pr-4">
                    Place
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right">
                    Has plan
                  </th>
                  <th scope="col" className="py-2.5 pl-3 text-right">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {group.places.map((place) => (
                  <tr key={place.id}>
                    <th scope="row" className="py-3 pr-4 font-semibold text-gray-900">
                      {place.name}
                    </th>
                    <td className="px-3 py-3 text-right">
                      <Mono className="font-bold text-gray-900">
                        {place.has} of {place.of}
                      </Mono>
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {place.change !== null ? (
                        <span className="inline-flex items-center justify-end gap-1">
                          <ChangeBadge value={place.change} className="text-[13px]" />
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Trends and activity */}
      <TrendsSection
        pillarLabel={pillarName}
        category={category}
        campusTrend={campusTrend}
        offCampusTrend={offCampusTrend}
        changes={group.changes}
        changeWords={{
          worse: 'lost a plan',
          same: 'kept a plan',
          better: 'gained a plan',
        }}
        activity={group.activity}
        overdue={group.overdue}
        notYetAssessed={group.notYetAssessed}
        assessed={total}
        reassessed={reassessed}
      />
    </div>
  );
}
