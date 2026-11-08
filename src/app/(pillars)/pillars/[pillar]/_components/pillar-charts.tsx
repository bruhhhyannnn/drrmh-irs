'use client';

import { ActivityBars } from '@/app/(admin)/_components/charts/activity-bars';
import { BandBars } from '@/app/(admin)/_components/charts/band-bars';
import { ChangeBadge } from '@/app/(admin)/_components/charts/change-badge';
import { ChangeBar, type ChangeKind } from '@/app/(admin)/_components/charts/change-bar';
import { LineChart } from '@/app/(admin)/_components/charts/line-chart';
import { Card, EmptyNote, Mono } from '@/app/(admin)/_components/ui';
import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { percent, type Tally } from '@/lib/assessment-score';
import type { Named } from '@/lib/assessment-template';
import type { BuildingCategory } from '@/lib/building-place';
import type { SectionRow } from '@/lib/building-safety';
import type { Band } from '@/lib/pillar-trends';
import { useState } from 'react';
import { BuildingLink, NONE, pct } from './shared';

function parseQuarter(label: string): number {
  const match = label.match(/^Q(\d)\s+(\d{4})$/);
  if (!match) return 0;
  return parseInt(match[2], 10) * 4 + (parseInt(match[1], 10) - 1);
}

/** Chart A: Quarterly score over time for Campus and Off-campus. */
export function ScoreOverTimeChart({
  campusTrend,
  offCampusTrend,
  pillarLabel,
}: {
  campusTrend: { label: string; tally: Tally | null }[];
  offCampusTrend: { label: string; tally: Tally | null }[];
  pillarLabel: string;
}) {
  const quarterLabels = Array.from(
    new Set([...campusTrend.map((t) => t.label), ...offCampusTrend.map((t) => t.label)])
  ).sort((a, b) => parseQuarter(a) - parseQuarter(b));

  if (quarterLabels.length === 0) {
    return <EmptyNote>No quarterly assessment history yet.</EmptyNote>;
  }

  const campusValues = quarterLabels.map((q) => {
    const item = campusTrend.find((t) => t.label === q);
    return item?.tally ? percent(item.tally) : null;
  });

  const offCampusValues = quarterLabels.map((q) => {
    const item = offCampusTrend.find((t) => t.label === q);
    return item?.tally ? percent(item.tally) : null;
  });

  const lines = [
    {
      id: 'campus',
      name: 'Campus',
      color: 'var(--series-1)',
      values: campusValues,
    },
    {
      id: 'off_campus',
      name: 'Off-campus',
      color: 'var(--series-2)',
      values: offCampusValues,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <LineChart
        label={`${pillarLabel}: quarterly score over time`}
        points={quarterLabels.map((q) => ({ label: q }))}
        lines={lines}
      />
      <figcaption className="sr-only">
        Quarterly score over time: Campus (
        {quarterLabels.map((q, i) => `${q}: ${campusValues[i] ?? '—'}%`).join(', ')}) vs Off-campus
        ({quarterLabels.map((q, i) => `${q}: ${offCampusValues[i] ?? '—'}%`).join(', ')})
      </figcaption>
    </div>
  );
}

/** Chart B: Buildings by score band with interactive drill-down. */
export function ScoreBandsChart({
  bands,
  category,
  assessed,
}: {
  bands: { bands: { band: Band; label: string; buildings: Named[] }[]; noScore: number };
  category: BuildingCategory;
  assessed: number;
}) {
  const [selectedBand, setSelectedBand] = useState<Band | null>(null);

  if (assessed === 0) {
    return <EmptyNote>{NONE[category]}</EmptyNote>;
  }

  const selectedBandObj = bands.bands.find((b) => b.band === selectedBand);

  return (
    <div className="flex flex-col gap-3">
      <BandBars
        bands={bands.bands.map((b) => ({
          band: b.band,
          label: b.label,
          count: b.buildings.length,
        }))}
        selected={selectedBand}
        onSelect={(b) => setSelectedBand((prev) => (prev === b ? null : (b as Band)))}
      />

      {bands.noScore > 0 && (
        <p className="text-[13px] text-gray-500">
          <Mono className="font-semibold text-gray-800">{bands.noScore}</Mono>{' '}
          {bands.noScore === 1 ? 'building has' : 'buildings have'} no score (nothing counted in
          this pillar).
        </p>
      )}

      {selectedBand && selectedBandObj && (
        <div className="border-line mt-1 rounded-xl border bg-gray-50/60 p-3.5">
          <h3 className="mb-2 text-[12px] font-bold tracking-wider text-gray-500 uppercase">
            Buildings in {selectedBandObj.label} ({selectedBandObj.buildings.length})
          </h3>
          {selectedBandObj.buildings.length === 0 ? (
            <p className="text-[13px] text-gray-500">No buildings in this score band.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {selectedBandObj.buildings.map((b) => (
                <li key={b.id}>
                  <BuildingLink id={b.id} name={b.name} category={category} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Chart C: Re-assessed buildings change (worse / same / better) with drill-down. */
export function ChangeChart({
  changes,
  words = { worse: 'worse', same: 'same', better: 'better' },
  category,
  reassessed,
}: {
  changes: { worse: Named[]; same: Named[]; better: Named[] };
  words?: Record<ChangeKind, string>;
  category: BuildingCategory;
  reassessed: number;
}) {
  const [selectedKind, setSelectedKind] = useState<ChangeKind | null>(null);

  if (reassessed === 0) {
    return <EmptyNote>No re-assessed buildings yet to show change.</EmptyNote>;
  }

  const selectedBuildings = selectedKind ? changes[selectedKind] : [];

  return (
    <div className="flex flex-col gap-3">
      <ChangeBar
        counts={{
          worse: changes.worse.length,
          same: changes.same.length,
          better: changes.better.length,
        }}
        words={words}
        selected={selectedKind}
        onSelect={(k) => setSelectedKind((prev) => (prev === k ? null : k))}
      />

      {selectedKind && (
        <div className="border-line mt-1 rounded-xl border bg-gray-50/60 p-3.5">
          <h3 className="mb-2 text-[12px] font-bold tracking-wider text-gray-500 uppercase">
            Buildings that are {words[selectedKind]} ({selectedBuildings.length})
          </h3>
          {selectedBuildings.length === 0 ? (
            <p className="text-[13px] text-gray-500">No buildings in this group.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {selectedBuildings.map((b) => (
                <li key={b.id}>
                  <BuildingLink id={b.id} name={b.name} category={category} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** Chart D: Section scores as horizontal bars, lowest first. */
export function SectionBars({ sections }: { sections: SectionRow[] }) {
  if (sections.length === 0) {
    return <EmptyNote>No section scores recorded for this pillar.</EmptyNote>;
  }

  const sorted = [...sections].sort(
    (a, b) => (percent(a.current) ?? 0) - (percent(b.current) ?? 0)
  );

  return (
    <ul className="flex flex-col">
      {sorted.map((s) => {
        const scorePct = percent(s.current) ?? 0;
        return (
          <li
            key={s.code}
            className="border-line flex flex-col gap-1.5 border-b py-2.5 last:border-b-0"
          >
            <div className="flex items-center justify-between text-[14px]">
              <span className="font-semibold text-gray-800">
                <Mono className="mr-1.5 text-gray-500">{s.code}.</Mono>
                {s.title_en}
              </span>
              <span className="flex items-center gap-2">
                <Mono className="font-bold text-gray-900">{pct(s.current)}</Mono>
                {s.change !== null && (
                  <span className="flex items-baseline gap-1">
                    <ChangeBadge value={s.change} className="text-[12px]" />
                    <span className="text-[11px] text-gray-500">pts</span>
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="bg-brand-solid h-full rounded-full transition-all"
                style={{ width: `${scorePct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Chart E: Assessments per month and overdue buildings. */
export function ActivityChart({
  activity,
  overdue,
  notYetAssessed,
  category,
  assessed,
}: {
  activity: { label: string; count: number }[];
  overdue: Named[];
  notYetAssessed: number;
  category: BuildingCategory;
  assessed: number;
}) {
  const [showOverdue, setShowOverdue] = useState(false);

  if (assessed === 0) {
    return <EmptyNote>{NONE[category]}</EmptyNote>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_220px] items-start">
      <div>
        <h4 className="mb-3 text-[14px] font-semibold text-gray-700">Monthly assessments</h4>
        <ActivityBars months={activity} />
      </div>

      <div className="border-line bg-surface flex flex-col gap-3 rounded-[18px] border p-4">
        <div>
          <span className="text-[12px] font-bold tracking-wider text-gray-500 uppercase">
            Overdue
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <Mono className="text-[28px] font-extrabold text-gray-900">{overdue.length}</Mono>
            <span className="text-[12px] text-gray-500">over 12 months</span>
          </div>
          {category === 'campus' && notYetAssessed > 0 && (
            <p className="mt-2 text-[12px] text-gray-600">
              <Mono className="font-bold text-gray-800">{notYetAssessed}</Mono> active campus{' '}
              {notYetAssessed === 1 ? 'building' : 'buildings'} not yet assessed
            </p>
          )}
        </div>

        {overdue.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowOverdue((prev) => !prev)}
              aria-expanded={showOverdue}
              className={cn('text-[13px] font-semibold text-brand-500 hover:underline', FOCUS_RING)}
            >
              {showOverdue ? 'Hide buildings' : `Show ${overdue.length} overdue`}
            </button>
            {showOverdue && (
              <ul className="border-line mt-2 flex max-h-36 flex-col gap-1 overflow-y-auto border-t pt-2">
                {overdue.map((b) => (
                  <li key={b.id}>
                    <BuildingLink id={b.id} name={b.name} category={category} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Trends and charts card combining A, B, C, and E. */
export function TrendsSection({
  pillarLabel,
  category,
  campusTrend,
  offCampusTrend,
  bands,
  changes,
  changeWords,
  activity,
  overdue,
  notYetAssessed,
  assessed,
  reassessed,
}: {
  pillarLabel: string;
  category: BuildingCategory;
  campusTrend: { label: string; tally: Tally | null }[];
  offCampusTrend: { label: string; tally: Tally | null }[];
  bands?: { bands: { band: Band; label: string; buildings: Named[] }[]; noScore: number };
  changes: { worse: Named[]; same: Named[]; better: Named[] };
  changeWords?: Record<ChangeKind, string>;
  activity: { label: string; count: number }[];
  overdue: Named[];
  notYetAssessed: number;
  assessed: number;
  reassessed: number;
}) {
  return (
    <Card className="flex flex-col gap-6 p-4.5 md:p-6">
      <div>
        <h2 className="text-[19px] font-bold">Trends and activity</h2>
        <p className="text-[13px] text-gray-500">
          Quarterly movement, score distribution, and assessment frequency.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-[16px] font-bold">A. Score over time</h3>
        <p className="text-[13px] text-gray-500">
          Quarterly pooled score for Campus vs Off-campus. Shows whether fixes and drills are paying
          off.
        </p>
        <ScoreOverTimeChart
          campusTrend={campusTrend}
          offCampusTrend={offCampusTrend}
          pillarLabel={pillarLabel}
        />
      </div>

      {bands && (
        <div className="border-line flex flex-col gap-3 border-t pt-5">
          <h3 className="text-[16px] font-bold">B. Buildings by score band</h3>
          <p className="text-[13px] text-gray-500">
            One pooled score can hide unsafe buildings. Tap a band to list its buildings.
          </p>
          <ScoreBandsChart bands={bands} category={category} assessed={assessed} />
        </div>
      )}

      <div className="border-line flex flex-col gap-3 border-t pt-5">
        <h3 className="text-[16px] font-bold">C. Did re-assessed buildings improve?</h3>
        <p className="text-[13px] text-gray-500">
          Latest vs previous score. Counts buildings, not points.
        </p>
        <ChangeChart
          changes={changes}
          words={changeWords}
          category={category}
          reassessed={reassessed}
        />
      </div>

      <div className="border-line flex flex-col gap-3 border-t pt-5">
        <h3 className="text-[16px] font-bold">E. Assessment activity and overdue</h3>
        <p className="text-[13px] text-gray-500">
          Assessments ended in each of the last 12 months, and buildings overdue for re-assessment.
        </p>
        <ActivityChart
          activity={activity}
          overdue={overdue}
          notYetAssessed={notYetAssessed}
          category={category}
          assessed={assessed}
        />
      </div>
    </Card>
  );
}
