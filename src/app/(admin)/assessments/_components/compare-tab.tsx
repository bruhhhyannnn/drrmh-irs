'use client';

import { SelectField } from '@/components/ds';
import { useBuildingSummaries } from '@/components/hooks/use-assessments';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FilterSelect, ListToolbar } from '../../_components/data-list';
import { useScopedCampusId } from '../../_components/shell/campus-switcher';
import { EmptyNote, Skeleton } from '../../_components/ui';
import { plural } from '../../_lib/format';
import { BuildingCompareView } from '../../dashboard/_components/building-safety/building-level';

/** Compare a building's assessments (history line + A/B side-by-side) right on /assessments. */
export function CompareTab() {
  const campusId = useScopedCampusId();
  const { data = [], isPending, error } = useBuildingSummaries(campusId);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [clusterId, setClusterId] = useState('');

  if (isPending) {
    return (
      <div className="p-5">
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (error) {
    return <EmptyNote>The buildings couldn&apos;t be loaded: {error.message}</EmptyNote>;
  }

  const clusters = [...new Map(data.map((b) => [b.cluster.id, b.cluster])).values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const buildings = clusterId ? data.filter((b) => b.cluster.id === clusterId) : data;
  const requestedId = params.get('building');
  const selected =
    buildings.find((b) => b.id === requestedId) ??
    buildings.find((b) => b.assessment_count >= 2) ??
    buildings.find((b) => b.assessment_count > 0) ??
    buildings[0] ??
    null;

  const setParams = (next: { building?: string | null; a?: string | null; b?: string | null }) => {
    const p = new URLSearchParams(params.toString());
    p.set('tab', 'compare');
    if ('building' in next) {
      if (next.building) p.set('building', next.building);
      else p.delete('building');
      p.delete('a');
      p.delete('b');
    }
    if ('a' in next) {
      if (next.a) p.set('a', next.a);
      else p.delete('a');
    }
    if ('b' in next) {
      if (next.b) p.set('b', next.b);
      else p.delete('b');
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  if (data.length === 0) {
    return <EmptyNote>No buildings yet. ERT members add them when they assess one.</EmptyNote>;
  }

  return (
    <div className="flex flex-col">
      <ListToolbar>
        <div className="min-w-0 flex-[1_1_260px]">
          <SelectField
            id="compare-building"
            value={selected?.id ?? ''}
            onChange={(id) => setParams({ building: id })}
            placeholder="Select a building"
            options={buildings.map((b) => ({
              value: b.id,
              label: `${b.name} · ${b.unit.name} (${plural(
                b.assessment_count,
                'assessment',
                'assessments'
              )})`,
            }))}
          />
        </div>
        <FilterSelect
          label="Cluster"
          allLabel="All clusters"
          value={clusterId}
          onChange={setClusterId}
          options={clusters.map((c) => ({ value: c.id, label: c.name }))}
        />
      </ListToolbar>

      <div className="flex flex-col gap-5 border-t border-line p-4.5 md:p-6">
        {!selected ? (
          <EmptyNote>No buildings in this cluster.</EmptyNote>
        ) : (
          <BuildingCompareView
            buildingId={selected.id}
            aId={selected.id === requestedId ? params.get('a') : null}
            bId={selected.id === requestedId ? params.get('b') : null}
            onPick={(a, b) => setParams({ building: selected.id, a, b })}
          />
        )}
      </div>
    </div>
  );
}
