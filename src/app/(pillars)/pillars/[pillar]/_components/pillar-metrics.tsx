'use client';

import { ChangeBadge } from '@/app/(admin)/_components/charts/change-badge';
import { GroupedBars, SERIES_COLORS } from '@/app/(admin)/_components/charts/grouped-bars';
import { useScopedCampusId } from '@/app/(admin)/_components/shell/campus-switcher';
import { Card, CardHeading, EmptyNote, Mono } from '@/app/(admin)/_components/ui';
import {
  MostFailed,
  pct,
  SectionScores,
} from '@/app/(admin)/dashboard/_components/building-safety/parts';
import { Bilingual } from '@/components/assessment/bilingual';
import { FOCUS_RING } from '@/components/ds';
import { usePillarMetrics } from '@/components/hooks/use-pillars';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib';
import { percent } from '@/lib/assessment-score';
import type { PillarCode } from '@/lib/assessment-template';
import type { BuildingCategory } from '@/lib/building-place';
import type { PillarGroup, RecoveryGroup } from '@/lib/pillar-metrics';
import { PILLARS } from '@/lib/pillars';
import Link from 'next/link';
import { ScopeNote } from '../../_components/scope-note';

const TITLES: Record<BuildingCategory, string> = { campus: 'Campus', off_campus: 'Off-campus' };
const NONE: Record<BuildingCategory, string> = {
  campus: 'No campus assessments yet.',
  off_campus: 'No off-campus assessments yet.',
};

const compareHref = (id: string, category: BuildingCategory) =>
  `/assessments?tab=compare&building=${id}${category === 'off_campus' ? '&category=off_campus' : ''}`;

const buildingCount = (n: number) => `${n} ${n === 1 ? 'building' : 'buildings'} assessed`;
const asPercent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

/** A building's name, linking to its history on the Assessments page. */
function BuildingLink({
  id,
  name,
  label,
  category,
}: {
  id: string;
  name: string;
  label: string;
  category: BuildingCategory;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <Link
        href={compareHref(id, category)}
        className={cn('text-brand-500 rounded font-semibold hover:underline', FOCUS_RING)}
      >
        {name}
      </Link>
      <span className="text-[13px] text-gray-500">{label}</span>
    </span>
  );
}

/** The headline for one group: its score and change, how many buildings, and the N/A rate. */
function ScoreTile({ category, group }: { category: BuildingCategory; group: PillarGroup }) {
  return (
    <div className="border-line bg-surface flex flex-col gap-1 rounded-[18px] border px-4.5 py-4">
      <span className="text-[14px] font-semibold text-gray-600">{TITLES[category]}</span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <Mono className="text-[28px] leading-[1.1] font-extrabold text-gray-900">
          {pct(group.tally)}
        </Mono>
        {group.change !== null && (
          <span className="flex items-baseline gap-1">
            <ChangeBadge value={group.change} className="text-[14px]" />
            <span className="text-[13px] text-gray-500">pts</span>
          </span>
        )}
      </span>
      <span className="text-[14px] text-gray-600">{buildingCount(group.assessed)}</span>
      <span className="text-[14px] text-gray-600">
        <Mono>{asPercent(group.naRate)}</Mono> of answers were N/A
      </span>
    </div>
  );
}

/** One group's detail: where it's weakest, which buildings, what to fix, and how well it fits. */
function GroupDetail({
  category,
  group,
  pillar,
}: {
  category: BuildingCategory;
  group: PillarGroup;
  pillar: PillarCode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="text-[19px] font-bold">{TITLES[category]}</h2>
      {group.assessed === 0 ? (
        <EmptyNote>{NONE[category]}</EmptyNote>
      ) : (
        <>
          {group.places.length > 0 && (
            <div className="flex flex-col gap-2">
              <CardHeading level={3} title="By place" />
              <table className="w-full text-left text-[15px]">
                <caption className="sr-only">
                  {TITLES[category]} scores by campus, cluster or location
                </caption>
                <thead className="border-line border-b text-[12px] font-bold tracking-[.06em] text-gray-500 uppercase">
                  <tr>
                    <th scope="col" className="py-2 pr-3">
                      Place
                    </th>
                    <th scope="col" className="px-2 py-2 text-right">
                      Assessed
                    </th>
                    <th scope="col" className="py-2 pl-2 text-right">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.places.map((place) => (
                    <tr key={place.id} className="border-line border-b last:border-b-0">
                      <th scope="row" className="py-2 pr-3 font-normal">
                        {place.name}
                      </th>
                      <td className="px-2 py-2 text-right">
                        <Mono>{place.assessed}</Mono>
                      </td>
                      <td className="py-2 pl-2 text-right">
                        <Mono>{pct(place.tally)}</Mono>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {group.lowest.length > 0 && (
            <div className="flex flex-col gap-2">
              <CardHeading level={3} title="Lowest-scoring buildings" />
              <ul className="flex flex-col">
                {group.lowest.map((b) => (
                  <li
                    key={b.id}
                    className="border-line flex items-center justify-between gap-3 border-b py-2 last:border-b-0"
                  >
                    <BuildingLink {...b} />
                    <Mono className="shrink-0">{pct(b.tally)}</Mono>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SectionScores rows={group.sections} />
          <MostFailed
            groups={group.mostFailed.length > 0 ? [{ pillar, items: group.mostFailed }] : []}
          />

          {group.mostNa.length > 0 && (
            <div className="flex flex-col gap-2">
              <CardHeading level={3} title="Most often N/A" />
              <p className="text-[14px] text-gray-600">
                Many N/A answers can mean the question doesn&apos;t fit these buildings.
              </p>
              <ul className="flex flex-col">
                {group.mostNa.map((item) => (
                  <li
                    key={item.label}
                    className="border-line flex items-start justify-between gap-3 border-b py-2 text-[15px] last:border-b-0"
                  >
                    <span className="min-w-0">
                      <Mono className="text-gray-500">{item.label}</Mono>{' '}
                      <Bilingual en={item.prompt_en} fil={item.prompt_fil} />
                    </span>
                    <Mono className="shrink-0">
                      {item.na}/{item.of}
                    </Mono>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ScoredPillar({
  pillar,
  campus,
  offCampus,
}: {
  pillar: PillarCode;
  campus: PillarGroup;
  offCampus: PillarGroup;
}) {
  const label = PILLARS.find((p) => p.slug === pillar)?.label ?? pillar;
  const groups = [
    { id: 'campus' as const, group: campus },
    { id: 'off_campus' as const, group: offCampus },
  ];
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <ScoreTile category="campus" group={campus} />
        <ScoreTile category="off_campus" group={offCampus} />
      </div>
      {campus.assessed > 0 && offCampus.assessed > 0 && (
        <GroupedBars
          label={`${label}: campus and off-campus`}
          groups={[label]}
          series={groups.map(({ id, group }, i) => ({
            id,
            name: TITLES[id],
            color: SERIES_COLORS[i],
            values: [percent(group.tally)],
            previous: [null],
          }))}
        />
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {groups.map(({ id, group }) => (
          <GroupDetail key={id} category={id} group={group} pillar={pillar} />
        ))}
      </div>
    </>
  );
}

function RecoveryPanel({ category, group }: { category: BuildingCategory; group: RecoveryGroup }) {
  const total = group.in_place + group.missing + group.na;
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="text-[19px] font-bold">{TITLES[category]}</h2>
      {total === 0 ? (
        <EmptyNote>{NONE[category]}</EmptyNote>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {(
              [
                ['In place', group.in_place],
                ['Missing', group.missing],
                ['N/A', group.na],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="border-line bg-surface flex flex-col gap-1 rounded-[18px] border px-4 py-3"
              >
                <dt className="text-[14px] font-semibold text-gray-600">{label}</dt>
                <dd>
                  <Mono className="text-[24px] font-extrabold">{value}</Mono>
                </dd>
              </div>
            ))}
          </dl>

          {group.places.length > 0 && (
            <div className="flex flex-col gap-2">
              <CardHeading level={3} title="By place" />
              <ul className="flex flex-col">
                {group.places.map((place) => (
                  <li
                    key={place.id}
                    className="border-line flex items-center justify-between gap-3 border-b py-2 text-[15px] last:border-b-0"
                  >
                    {place.name}
                    <Mono className="shrink-0">
                      {place.has} of {place.of}
                    </Mono>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <CardHeading level={3} title="Buildings with no plan" />
            {group.missingBuildings.length === 0 ? (
              <EmptyNote>None.</EmptyNote>
            ) : (
              <ul className="flex flex-col">
                {group.missingBuildings.map((b) => (
                  <li key={b.id} className="border-line border-b py-2 last:border-b-0">
                    <BuildingLink {...b} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** A pillar's assessment results, Campus beside Off-campus. */
export function PillarMetricsSection({ slug }: { slug: string }) {
  const campusId = useScopedCampusId();
  const { data, isPending, error } = usePillarMetrics(slug, campusId);

  if (isPending) return <Skeleton className="h-80" />;
  if (error) {
    return (
      <Card className="text-error-700 p-6 text-[16px]">
        This pillar couldn&apos;t be loaded: {error.message}
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
    <Card className="flex flex-col gap-5 p-4.5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <ScopeNote />
        <Link
          href="/pillars"
          className={cn('text-brand-500 rounded text-[14px] font-semibold', FOCUS_RING)}
        >
          All pillars
        </Link>
      </div>
      {data.kind === 'scored' ? (
        <ScoredPillar
          pillar={slug as PillarCode}
          campus={data.campus}
          offCampus={data.off_campus}
        />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <RecoveryPanel category="campus" group={data.campus} />
          <RecoveryPanel category="off_campus" group={data.off_campus} />
        </div>
      )}
    </Card>
  );
}
