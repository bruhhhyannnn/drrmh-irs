'use client';

import { SelectField } from '@/components/ds';
import { useBuildingHistory, useCompareAssessments } from '@/components/hooks/use-assessments';
import { percent } from '@/lib/assessment-score';
import { comparePair, type CompareRow, type DashboardScope } from '@/lib/building-safety';
import Link from 'next/link';
import { useState } from 'react';
import { ChangeBadge } from '../../../_components/charts/change-badge';
import { SERIES_COLORS } from '../../../_components/charts/grouped-bars';
import { LineChart } from '../../../_components/charts/line-chart';
import { Card, CardHeading, EmptyNote, Mono, Skeleton } from '../../../_components/ui';
import { formatDate } from '../../../_lib/format';
import { trailParts, type Go } from './building-safety';
import { Breadcrumb, pct, pillarLabel, recoveryText, SCORED_PILLARS } from './parts';

const detailHref = (id: string) => `/assessments/details?id=${id}`;

/** One building: its overall score across #1…#n, and any two of its assessments side by side. */
export function BuildingLevel({
  scope,
  go,
  isSuperAdmin,
}: {
  scope: DashboardScope;
  go: Go;
  isSuperAdmin: boolean;
}) {
  const { data: history, isPending } = useBuildingHistory(scope.buildingId);
  const [showPillars, setShowPillars] = useState(false);
  const list = history?.assessments ?? [];
  const pair = comparePair(
    list.map((a) => a.id),
    scope.a,
    scope.b
  );
  const compare = useCompareAssessments(pair.a, pair.b);

  if (isPending) return <Skeleton className="h-80" />;
  if (!history) {
    return (
      <Card className="p-6">
        <EmptyNote>This building isn&apos;t available. It may be at another campus.</EmptyNote>
      </Card>
    );
  }

  const { building } = history;
  const parts = trailParts(
    { campus: building.campus, cluster: building.cluster, unit: building.unit },
    go,
    isSuperAdmin,
    building.name
  );
  const byId = new Map(list.map((a) => [a.id, a]));
  const option = (a: (typeof list)[number]) =>
    `#${a.number} · ${formatDate(a.ended_at)} · ${pct(a.overall)}${a.event_name ? ` · ${a.event_name}` : ''}`;
  const A = pair.a ? byId.get(pair.a) : undefined;
  const B = pair.b ? byId.get(pair.b) : undefined;

  return (
    <Card className="flex flex-col gap-5 p-4.5 md:p-6">
      <Breadcrumb parts={parts} />
      {list.length === 0 ? (
        <EmptyNote>{building.name} hasn&apos;t been assessed yet.</EmptyNote>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <CardHeading
              level={3}
              title="History"
              aside={
                <label className="flex items-center gap-2 text-[14px] font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={showPillars}
                    onChange={(e) => setShowPillars(e.target.checked)}
                    className="size-4 accent-[var(--brand-500)]"
                  />
                  Show pillars
                </label>
              }
            />
            <LineChart
              label={`${building.name}: score by assessment`}
              points={list.map((a) => ({
                label: `#${a.number}`,
                sublabel: formatDate(a.ended_at),
                marker: a.event_name ?? undefined,
              }))}
              lines={[
                {
                  id: 'overall',
                  name: 'Overall',
                  color: 'var(--brand-500)',
                  values: list.map((a) => percent(a.overall)),
                },
                ...(showPillars
                  ? SCORED_PILLARS.map((code, i) => ({
                      id: code,
                      name: pillarLabel(code),
                      color: SERIES_COLORS[i],
                      values: list.map((a) => percent(a.pillars[code])),
                    }))
                  : []),
              ]}
            />
          </div>

          <div className="flex flex-col gap-3">
            <CardHeading level={3} title="Compare two assessments" />
            {list.length < 2 ? (
              <p className="text-[15px] text-gray-600">Needs a second assessment to compare.</p>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  {(['a', 'b'] as const).map((side) => {
                    const other = side === 'a' ? pair.b : pair.a;
                    return (
                      <label key={side} className="flex flex-col gap-1.5">
                        <span className="text-[14px] font-semibold text-gray-700">
                          {side === 'a' ? 'A (before)' : 'B (after)'}
                        </span>
                        <SelectField
                          id={`bs-${side}`}
                          placeholder="Pick an assessment"
                          value={(side === 'a' ? pair.a : pair.b) ?? ''}
                          onChange={(id) =>
                            go({
                              [side === 'a' ? 'bs_a' : 'bs_b']: id,
                              ...(side === 'a' ? { bs_b: pair.b } : { bs_a: pair.a }),
                            })
                          }
                          options={list
                            .filter((a) => a.id !== other)
                            .map((a) => ({ value: a.id, label: option(a) }))}
                        />
                      </label>
                    );
                  })}
                </div>
                {compare.data?.versionsDiffer && (
                  <p className="text-[14px] text-warning-700">
                    A and B were answered with different checklist versions; sections are matched by
                    their code.
                  </p>
                )}
                {compare.isPending ? (
                  <Skeleton className="h-60" />
                ) : !compare.data ? (
                  <EmptyNote>These two assessments can&apos;t be compared.</EmptyNote>
                ) : (
                  <CompareTable
                    rows={[
                      compare.data.overall,
                      ...compare.data.pillars.map((r) => ({
                        ...r,
                        title_en: pillarLabel(r.key as never),
                      })),
                      ...compare.data.sections.map((r) => ({
                        ...r,
                        title_en: `${r.key} ${r.title_en}`,
                      })),
                    ]}
                    aLabel={A ? `#${A.number}` : 'A'}
                    bLabel={B ? `#${B.number}` : 'B'}
                    aHref={A && detailHref(A.id)}
                    bHref={B && detailHref(B.id)}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function CompareTable({
  rows,
  aLabel,
  bLabel,
  aHref,
  bHref,
}: {
  rows: CompareRow[];
  aLabel: string;
  bLabel: string;
  aHref?: string;
  bHref?: string;
}) {
  const head = (label: string, href?: string) =>
    href ? (
      <Link href={href} className="text-brand-500 hover:underline">
        {label}
      </Link>
    ) : (
      label
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-120 text-left text-[15px]">
        <caption className="sr-only">
          {aLabel} against {bLabel}
        </caption>
        <thead className="border-b border-line text-[12px] font-bold tracking-[.06em] text-gray-500 uppercase">
          <tr>
            <th scope="col" className="py-2.5 pr-3" />
            <th scope="col" className="px-2 py-2.5 text-right">
              {head(aLabel, aHref)}
            </th>
            <th scope="col" className="px-2 py-2.5 text-right">
              {head(bLabel, bHref)}
            </th>
            <th scope="col" className="py-2.5 pl-2 text-right">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const recovery = row.key === 'rehabilitation-recovery';
            const cell = (t: CompareRow['a']) => (recovery ? recoveryText(t) : pct(t));
            const strong = row.key === 'overall';
            return (
              <tr key={row.key} className="border-b border-line last:border-b-0">
                <th
                  scope="row"
                  className={strong ? 'py-2.5 pr-3 font-bold' : 'py-2.5 pr-3 font-normal'}
                >
                  {row.title_en}
                </th>
                <td className="px-2 py-2.5 text-right">
                  <Mono>{cell(row.a)}</Mono>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <Mono className={strong ? 'font-bold' : undefined}>{cell(row.b)}</Mono>
                </td>
                <td className="py-2.5 pl-2 text-right">
                  {recovery ? null : <ChangeBadge value={row.change} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
