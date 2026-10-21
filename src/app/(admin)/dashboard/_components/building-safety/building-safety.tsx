'use client';

import { FOCUS_RING } from '@/components/ds';
import { useSafetyRollup } from '@/components/hooks/use-assessments';
import { cn } from '@/lib';
import { percent } from '@/lib/assessment-score';
import { scopeFromParams, type ChildRow, type SafetyRollup } from '@/lib/building-safety';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { GroupedBars, SERIES_COLORS } from '../../../_components/charts/grouped-bars';
import { RowChart } from '../../../_components/charts/row-chart';
import { useIsSuperAdmin, useScopedCampusId } from '../../../_components/shell/campus-switcher';
import { Card, CardHeading, EmptyNote, Skeleton } from '../../../_components/ui';
import { plural } from '../../../_lib/format';
import { BuildingLevel } from './building-level';
import {
  Breadcrumb,
  ChildrenTable,
  MostFailed,
  pillarLabel,
  SCORED_PILLARS,
  SectionScores,
  SummaryTiles,
} from './parts';

// The dashboard's Building safety section (DRRM-015, spec 4.3): Campus → Cluster → Unit →
// Building, drilled in place. The level lives in the URL (bs_campus, bs_cluster, bs_unit,
// bs_building, bs_a, bs_b), so Back walks up and a view can be shared. Drilling never moves the
// top-bar campus switcher; changing the switcher starts over at its campus.

export type BsKey = 'bs_campus' | 'bs_cluster' | 'bs_unit' | 'bs_building' | 'bs_a' | 'bs_b';
export type Go = (next: Partial<Record<BsKey, string | null>>) => void;

/** Drilling to a level clears the levels under it. */
const DEEPER: Record<BsKey, BsKey[]> = {
  bs_campus: ['bs_cluster', 'bs_unit', 'bs_building', 'bs_a', 'bs_b'],
  bs_cluster: ['bs_unit', 'bs_building', 'bs_a', 'bs_b'],
  bs_unit: ['bs_building', 'bs_a', 'bs_b'],
  bs_building: ['bs_a', 'bs_b'],
  bs_a: [],
  bs_b: [],
};

const ALL_CAMPUSES = 'all';

export function BuildingSafety() {
  return (
    <section aria-labelledby="building-safety" className="flex flex-col gap-3">
      <h2 id="building-safety" className="text-[22px] font-extrabold">
        Building safety
      </h2>
      <Suspense fallback={<Skeleton className="h-80" />}>
        <BuildingSafetyLevel />
      </Suspense>
    </section>
  );
}

function BuildingSafetyLevel() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isSuperAdmin = useIsSuperAdmin();
  const switcherCampusId = useScopedCampusId();
  const scope = scopeFromParams(params, { isSuperAdmin, switcherCampusId });

  const go: Go = (next) => {
    const p = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next) as [BsKey, string | null][]) {
      for (const deeper of DEEPER[key]) if (!(deeper in next)) p.delete(deeper);
      if (value) p.set(key, value);
      else p.delete(key);
    }
    const query = p.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // A new campus in the switcher starts the section over at that campus.
  const switcher = useRef(switcherCampusId);
  useEffect(() => {
    if (switcher.current === switcherCampusId) return;
    switcher.current = switcherCampusId;
    const p = new URLSearchParams(params.toString());
    for (const key of Object.keys(DEEPER)) p.delete(key);
    const query = p.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [switcherCampusId, params, pathname, router]);

  if (scope.buildingId) {
    return <BuildingLevel scope={scope} go={go} isSuperAdmin={isSuperAdmin} />;
  }
  return (
    <AggregateLevel
      campusId={scope.campusId === ALL_CAMPUSES ? null : scope.campusId}
      allCampuses={isSuperAdmin && (scope.campusId === ALL_CAMPUSES || !scope.campusId)}
      clusterId={scope.clusterId}
      unitId={scope.unitId}
      go={go}
      isSuperAdmin={isSuperAdmin}
    />
  );
}

const NOUNS = { campus: 'Campus', cluster: 'Cluster', unit: 'Unit', building: 'Building' };
const METRICS = ['overall', ...SCORED_PILLARS] as const;
type Metric = (typeof METRICS)[number];
const metricLabel = (m: Metric) => (m === 'overall' ? 'Overall' : pillarLabel(m));

/** The breadcrumb for an aggregate level, or a building's (from its history). */
export function trailParts(
  trail: SafetyRollup['trail'],
  go: Go,
  isSuperAdmin: boolean,
  last?: string
) {
  const parts: { label: string; onClick?: () => void }[] = [];
  if (isSuperAdmin)
    parts.push({ label: 'All campuses', onClick: () => go({ bs_campus: ALL_CAMPUSES }) });
  if (trail.campus) {
    const id = trail.campus.id;
    parts.push({
      label: trail.campus.name,
      onClick: () => go({ bs_campus: isSuperAdmin ? id : null }),
    });
  }
  if (trail.cluster) {
    const id = trail.cluster.id;
    parts.push({ label: trail.cluster.name, onClick: () => go({ bs_cluster: id }) });
  }
  if (trail.unit) {
    const id = trail.unit.id;
    parts.push({ label: trail.unit.name, onClick: () => go({ bs_unit: id }) });
  }
  if (last) parts.push({ label: last });
  return parts;
}

function AggregateLevel({
  campusId,
  allCampuses,
  clusterId,
  unitId,
  go,
  isSuperAdmin,
}: {
  campusId: string | null;
  allCampuses: boolean;
  clusterId: string | null;
  unitId: string | null;
  go: Go;
  isSuperAdmin: boolean;
}) {
  const { data, isPending, error } = useSafetyRollup({
    campusId: allCampuses ? null : campusId,
    clusterId,
    unitId,
  });
  const [metric, setMetric] = useState<Metric>('overall');

  if (isPending) return <Skeleton className="h-80" />;
  if (error) {
    return (
      <Card className="p-6 text-[17px] text-error-700">
        Building safety couldn&apos;t be loaded: {error.message}
      </Card>
    );
  }
  if (!data) {
    return (
      <Card className="flex flex-col gap-3 p-6">
        <EmptyNote>This level isn&apos;t available. It may be at another campus.</EmptyNote>
      </Card>
    );
  }

  const open = (row: ChildRow) =>
    row.kind === 'campus'
      ? go({ bs_campus: row.id })
      : row.kind === 'cluster'
        ? go({
            bs_cluster: row.id,
            ...(isSuperAdmin && data.trail.campus ? { bs_campus: data.trail.campus.id } : {}),
          })
        : row.kind === 'unit'
          ? go({
              bs_unit: row.id,
              ...(data.trail.cluster ? { bs_cluster: data.trail.cluster.id } : {}),
            })
          : go({ bs_building: row.id });
  const childKind = data.children[0]?.kind ?? (data.level === 'unit' ? 'building' : 'cluster');
  const noun = NOUNS[childKind];
  const parts = trailParts(data.trail, go, isSuperAdmin);
  const value = (row: ChildRow, m: Metric, t: 'current' | 'previous') => {
    const pooled = t === 'current' ? row.current : row.likeForLike?.previous;
    if (!pooled) return null;
    return percent(m === 'overall' ? pooled.overall : pooled.pillars[m]);
  };

  return (
    <Card className="flex flex-col gap-5 p-4.5 md:p-6">
      {parts.length > 0 && <Breadcrumb parts={parts} />}
      {data.group.assessed === 0 ? (
        <EmptyNote>
          No building has been assessed here yet
          {data.group.buildings > 0
            ? ` (${plural(data.group.buildings, 'building', 'buildings')} on record)`
            : ''}
          .
        </EmptyNote>
      ) : (
        <>
          <SummaryTiles group={data.group} />
          <div className="flex flex-col gap-3">
            <CardHeading
              level={3}
              title={`By ${noun.toLowerCase()}`}
              aside={
                data.children.length > 6 ? (
                  <div role="group" aria-label="Metric" className="flex flex-wrap gap-1.5">
                    {METRICS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={metric === m}
                        onClick={() => setMetric(m)}
                        className={cn(
                          'h-8 rounded-full border px-3 text-[13px] font-semibold',
                          metric === m
                            ? 'bg-brand-solid border-transparent text-white'
                            : 'border-gray-300 bg-surface text-gray-700 hover:bg-gray-50',
                          FOCUS_RING
                        )}
                      >
                        {metricLabel(m)}
                      </button>
                    ))}
                  </div>
                ) : undefined
              }
            />
            {data.children.length > 6 ? (
              <RowChart
                label={`${metricLabel(metric)} by ${noun.toLowerCase()}`}
                rows={data.children.map((row) => ({
                  id: row.id,
                  name: row.name,
                  value: value(row, metric, 'current'),
                  previous: value(row, metric, 'previous'),
                }))}
                onSelect={(id) => open(data.children.find((c) => c.id === id)!)}
              />
            ) : (
              <GroupedBars
                label={`Scores by ${noun.toLowerCase()}`}
                groups={METRICS.map(metricLabel)}
                series={data.children.map((row, i) => ({
                  id: row.id,
                  name: row.name,
                  color: SERIES_COLORS[i % SERIES_COLORS.length],
                  values: METRICS.map((m) => value(row, m, 'current')),
                  previous: METRICS.map((m) => value(row, m, 'previous')),
                }))}
                onSelect={(id) => open(data.children.find((c) => c.id === id)!)}
              />
            )}
            <ChildrenTable rows={data.children} noun={noun} onOpen={open} />
            {data.notAssessed.length > 0 && (
              <p className="text-[14px] text-gray-600">
                <span className="font-semibold">Not yet assessed ({data.notAssessed.length})</span>
                {data.level === 'unit' && `: ${data.notAssessed.map((b) => b.name).join(', ')}`}
              </p>
            )}
          </div>
          <SectionScores rows={data.sections} />
          <MostFailed groups={data.mostFailed} />
        </>
      )}
    </Card>
  );
}
