'use client';

import { FOCUS_RING, SegmentedControl } from '@/components/ds';
import { useOffCampusRollup, useSafetyRollup } from '@/components/hooks/use-assessments';
import { cn } from '@/lib';
import { percent } from '@/lib/assessment-score';
import {
  scopeFromParams,
  type ChildRow,
  type LocationCrumb,
  type LocationKind,
  type LocationScope,
  type SafetyRollup,
} from '@/lib/building-safety';
import type { BuildingLocation } from '@/lib/psgc';
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
// top-bar campus switcher; changing the switcher starts over at its campus. The Off-campus view
// (DRRM-024, bs_view) drills by location instead: bs_region, bs_province, bs_city, bs_barangay.

export type BsKey =
  | 'bs_view'
  | 'bs_campus'
  | 'bs_cluster'
  | 'bs_unit'
  | 'bs_region'
  | 'bs_province'
  | 'bs_city'
  | 'bs_barangay'
  | 'bs_building'
  | 'bs_a'
  | 'bs_b';
export type Go = (next: Partial<Record<BsKey, string | null>>) => void;

/** Drilling to a level clears the levels under it. */
const DEEPER: Record<BsKey, BsKey[]> = {
  bs_view: [
    'bs_campus',
    'bs_cluster',
    'bs_unit',
    'bs_region',
    'bs_province',
    'bs_city',
    'bs_barangay',
    'bs_building',
    'bs_a',
    'bs_b',
  ],
  bs_campus: ['bs_cluster', 'bs_unit', 'bs_building', 'bs_a', 'bs_b'],
  bs_cluster: ['bs_unit', 'bs_building', 'bs_a', 'bs_b'],
  bs_unit: ['bs_building', 'bs_a', 'bs_b'],
  bs_region: ['bs_province', 'bs_city', 'bs_barangay', 'bs_building', 'bs_a', 'bs_b'],
  bs_province: ['bs_city', 'bs_barangay', 'bs_building', 'bs_a', 'bs_b'],
  bs_city: ['bs_barangay', 'bs_building', 'bs_a', 'bs_b'],
  bs_barangay: ['bs_building', 'bs_a', 'bs_b'],
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
    const url = query ? `${pathname}?${query}` : pathname;
    // A new level is a history entry, so Back walks up; changing the A/B picks is not.
    const picksOnly = Object.keys(next).every((key) => key === 'bs_a' || key === 'bs_b');
    if (picksOnly) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  };

  // A new campus in the switcher starts the section over at that campus.
  const switcher = useRef(switcherCampusId);
  useEffect(() => {
    if (switcher.current === switcherCampusId) return;
    switcher.current = switcherCampusId;
    const p = new URLSearchParams(params.toString());
    // The view stays: only the level within it starts over.
    for (const key of DEEPER.bs_view) p.delete(key);
    const query = p.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [switcherCampusId, params, pathname, router]);

  const campusId = scope.campusId === ALL_CAMPUSES ? null : scope.campusId;
  return (
    <>
      <div className="max-w-sm">
        <SegmentedControl
          name="building-safety-view"
          labelledBy="building-safety"
          options={[
            { value: 'campus', label: 'Campuses' },
            { value: 'off_campus', label: 'Off-campus' },
          ]}
          value={scope.view}
          onChange={(view) => go({ bs_view: view === 'off_campus' ? view : null })}
        />
      </div>
      {scope.buildingId ? (
        <BuildingLevel scope={scope} go={go} isSuperAdmin={isSuperAdmin} />
      ) : scope.view === 'off_campus' ? (
        <OffCampusLevel campusId={campusId} location={scope.location} go={go} />
      ) : (
        <AggregateLevel
          campusId={campusId}
          allCampuses={isSuperAdmin && (scope.campusId === ALL_CAMPUSES || !scope.campusId)}
          clusterId={scope.clusterId}
          unitId={scope.unitId}
          go={go}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </>
  );
}

const NOUNS: Record<ChildRow['kind'], string> = {
  campus: 'Campus',
  cluster: 'Cluster',
  unit: 'Unit',
  building: 'Building',
  region: 'Region',
  province: 'Province',
  city: 'City or municipality',
  barangay: 'Barangay',
};
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

const LOCATION_PARAM: Record<LocationKind, BsKey> = {
  region: 'bs_region',
  province: 'bs_province',
  city: 'bs_city',
  barangay: 'bs_barangay',
};

/** The URL params that lead to a place. */
const paramsThrough = (crumbs: { kind: LocationKind; code: string }[]) =>
  Object.fromEntries(crumbs.map((c) => [LOCATION_PARAM[c.kind], c.code]));

export function crumbsOf(location: BuildingLocation): LocationCrumb[] {
  return [
    { kind: 'region', ...location.region },
    ...(location.province ? [{ kind: 'province' as const, ...location.province }] : []),
    { kind: 'city', ...location.city },
    { kind: 'barangay', ...location.barangay },
  ];
}

/** The breadcrumb of an off-campus level: Off-campus, then the places down to it. */
export function locationParts(trail: LocationCrumb[], go: Go) {
  return [
    {
      label: 'Off-campus',
      onClick: () => go({ bs_view: 'off_campus', bs_region: null }),
    },
    ...trail.map((crumb, i) => ({
      label: crumb.name,
      onClick: () =>
        go({
          bs_view: 'off_campus',
          bs_building: null,
          ...paramsThrough(trail.slice(0, i + 1)),
        }),
    })),
  ];
}

/** The tiles, the chart, the table, sections and most-failed items of one level. */
function LevelScores({
  data,
  noun,
  onOpen,
  showCoverage,
  footer,
}: {
  data: Pick<SafetyRollup, 'group' | 'children' | 'sections' | 'mostFailed'>;
  noun: string;
  onOpen: (row: ChildRow) => void;
  showCoverage?: boolean;
  footer?: React.ReactNode;
}) {
  const [metric, setMetric] = useState<Metric>('overall');
  const value = (row: ChildRow, m: Metric, t: 'current' | 'previous') => {
    const pooled = t === 'current' ? row.current : row.likeForLike?.previous;
    if (!pooled) return null;
    return percent(m === 'overall' ? pooled.overall : pooled.pillars[m]);
  };

  return (
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
            onSelect={(id) => onOpen(data.children.find((c) => c.id === id)!)}
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
            onSelect={(id) => onOpen(data.children.find((c) => c.id === id)!)}
          />
        )}
        <ChildrenTable
          rows={data.children}
          noun={noun}
          onOpen={onOpen}
          showCoverage={showCoverage}
        />
        {footer}
      </div>
      <SectionScores rows={data.sections} />
      <MostFailed groups={data.mostFailed} />
    </>
  );
}

/** Off-campus buildings by location. Never pooled with a campus's numbers. */
function OffCampusLevel({
  campusId,
  location,
  go,
}: {
  campusId: string | null;
  location: LocationScope;
  go: Go;
}) {
  const { data, isPending, error } = useOffCampusRollup({ campusId, ...location });

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
        <EmptyNote>This level isn&apos;t available.</EmptyNote>
      </Card>
    );
  }

  const open = (row: ChildRow) =>
    row.kind === 'building'
      ? go({ bs_building: row.id })
      : go(paramsThrough([...data.trail, { kind: row.kind as LocationKind, code: row.id }]));
  const kinds = new Set(data.children.map((row) => row.kind));
  const noun = kinds.size === 1 ? NOUNS[data.children[0].kind] : 'Place';

  return (
    <Card className="flex flex-col gap-5 p-4.5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Breadcrumb parts={locationParts(data.trail, go)} />
        <p className="text-[14px] text-gray-600">Not counted in campus scores.</p>
      </div>
      {data.group.assessed === 0 ? (
        <EmptyNote>No off-campus assessments yet.</EmptyNote>
      ) : (
        <LevelScores data={data} noun={noun} onOpen={open} showCoverage={false} />
      )}
    </Card>
  );
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
        <LevelScores
          data={data}
          noun={noun}
          onOpen={open}
          footer={
            data.notAssessed.length > 0 && (
              <p className="text-[14px] text-gray-600">
                <span className="font-semibold">Not yet assessed ({data.notAssessed.length})</span>
                {data.level === 'unit' && `: ${data.notAssessed.map((b) => b.name).join(', ')}`}
              </p>
            )
          }
        />
      )}
    </Card>
  );
}
