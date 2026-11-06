'use client';

import { ChangeBadge } from '@/app/(admin)/_components/charts/change-badge';
import { Card, EmptyNote, Mono } from '@/app/(admin)/_components/ui';
import type { BuildingCategory } from '@/lib/building-place';
import type { PlaceScore } from '@/lib/pillar-metrics';
import { NONE, pct } from './shared';

export function PlacesTable({
  category,
  places,
  assessed,
}: {
  category: BuildingCategory;
  places: PlaceScore[];
  assessed: number;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4.5 md:p-6">
      <div>
        <h2 className="text-[19px] font-bold">4. Where it&apos;s weakest</h2>
        <p className="text-[13px] text-gray-500">
          Campuses, clusters, or off-campus locations, ordered lowest score first.
        </p>
      </div>

      {assessed === 0 ? (
        <EmptyNote>{NONE[category]}</EmptyNote>
      ) : places.length === 0 ? (
        <EmptyNote>No places recorded.</EmptyNote>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <caption className="sr-only">
              Places ordered by score, showing building count, score, and change
            </caption>
            <thead className="border-line border-b text-[12px] font-bold tracking-wider text-gray-500 uppercase">
              <tr>
                <th scope="col" className="py-2.5 pr-4">
                  Place
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Assessed
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Score
                </th>
                <th scope="col" className="py-2.5 pl-3 text-right">
                  Change
                </th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {places.map((place) => (
                <tr key={place.id}>
                  <th scope="row" className="py-3 pr-4 font-semibold text-gray-900">
                    {place.name}
                  </th>
                  <td className="px-3 py-3 text-right">
                    <Mono>{place.assessed}</Mono>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Mono className="font-bold text-gray-900">{pct(place.tally)}</Mono>
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {place.change !== null ? (
                      <span className="inline-flex items-center justify-end gap-1">
                        <ChangeBadge value={place.change} className="text-[13px]" />
                        <span className="text-[11px] text-gray-500">pts</span>
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
  );
}
