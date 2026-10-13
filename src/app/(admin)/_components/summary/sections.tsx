'use client';

import { FOCUS_RING } from '@/components/ds';
import { cn } from '@/lib';
import { format } from 'date-fns';
import { ChartNoAxesColumn, Check, TriangleAlert, UserRound, Users } from 'lucide-react';
import { useState } from 'react';
import { formatTime, personName, plural } from '../../_lib/format';
import {
  firstReportScale,
  headcountOf,
  shortLabel,
  timelineLabels,
  timelineMilestones,
  timelineOf,
  timelineScale,
  type CompareRow,
  type Summary,
} from '../../_lib/summary';
import { FilterSelect } from '../data-list';
import { Bar, Card, Chip, Mono } from '../ui';
import { ColumnChart, DamageChart, Donut, RankedBars, SERIES, SeriesLegend } from './charts';

const PAD_X = 'px-4 md:px-5';

/* ─── Completed banner ───────────────────────────────────────────────────────────────── */

export function CompletedBanner({ summary }: { summary: Summary }) {
  const { event } = summary.source;
  const by = personName(event.completer);
  const pending = summary.clusters.pending.map((c) => c.name);
  return (
    <div className="flex items-start gap-3 rounded-[18px] border border-info-200 bg-info-50 px-4 py-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-info-700">
        <Check size={16} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[17px] leading-[1.4] font-bold">
          Completed
          {event.ended_at && ` on ${format(new Date(event.ended_at), "MMM d, yyyy 'at' h:mm a")}`}
          {by && ` by ${by}`}
        </span>
        <span className="text-[16px] leading-normal text-pretty text-gray-600">
          Reports are locked.{' '}
          {pending.length > 0 &&
            `${pending.join(', ')} did not report before the event was completed. `}
          To reopen it, edit the event and set the status to Ongoing.
        </span>
      </div>
    </div>
  );
}

/* ─── Overview tiles ─────────────────────────────────────────────────────────────────── */

const TILE_ICON = {
  neutral: 'bg-gray-100 text-gray-600',
  red: 'bg-error-50 text-error-700',
  amber: 'bg-warning-50 text-warning-700',
};

export function OverviewTiles({ summary }: { summary: Summary }) {
  const { totals, clusters } = summary;
  const tiles = [
    {
      label: 'Total affected',
      value: totals.people.toLocaleString(),
      sub: `Counted in ${plural(totals.clustersCounted, 'cluster', 'clusters')}`,
      icon: <Users size={18} aria-hidden />,
      tone: 'neutral' as const,
    },
    {
      label: 'Reports',
      value: totals.reports.toLocaleString(),
      sub: `From ${clusters.reported} of ${plural(clusters.total, 'cluster', 'clusters')}`,
      icon: <ChartNoAxesColumn size={18} aria-hidden />,
      tone: 'neutral' as const,
    },
    {
      label: 'Casualties',
      value: String(totals.casualties),
      sub: `${totals.serious} serious or worse`,
      icon: <TriangleAlert size={18} aria-hidden />,
      tone: 'red' as const,
    },
    {
      label: 'Missing',
      value: String(totals.missing),
      sub: `${totals.unidentified} not identified`,
      icon: <UserRound size={18} aria-hidden />,
      tone: 'amber' as const,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="flex min-w-0 flex-col gap-2 rounded-[18px] border border-gray-200 bg-surface px-4.5 py-4 shadow-[0_1px_3px_rgba(16,24,40,.06)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[14px] font-semibold text-gray-600">{t.label}</span>
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full',
                TILE_ICON[t.tone]
              )}
            >
              {t.icon}
            </span>
          </div>
          <Mono
            className={cn(
              'text-[30px] leading-none font-extrabold md:text-[34px]',
              t.tone === 'red' && t.value !== '0' && 'text-error-700',
              t.tone === 'amber' && t.value !== '0' && 'text-warning-700'
            )}
          >
            {t.value}
          </Mono>
          <span className="text-[14px] leading-[1.4] text-pretty text-gray-500">{t.sub}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Clusters ───────────────────────────────────────────────────────────────────────── */

const CLUSTER_GRID = 'grid grid-cols-[minmax(0,1.5fr)_72px_88px_minmax(0,1fr)] items-center gap-4';

function DoneMark() {
  return (
    <span className="bg-success-50 grid size-6 shrink-0 place-items-center rounded-full text-success-700">
      <Check size={13} strokeWidth={2.5} aria-hidden />
      <span className="sr-only">Reported</span>
    </span>
  );
}

function PendingMark() {
  return (
    <span
      aria-hidden
      className="bg-warning-50 size-6 shrink-0 rounded-full border-[1.5px] border-dashed border-[#fdb022]"
    />
  );
}

function NoReportChip() {
  return (
    <Chip tone="amber" dot>
      No report yet
    </Chip>
  );
}

export function ClustersCard({ summary }: { summary: Summary }) {
  const { done, pending, total, reported } = summary.clusters;
  const maxPeople = Math.max(1, ...done.map((c) => c.people));
  return (
    <Card className="flex flex-col">
      <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2.5 py-4', PAD_X)}>
        <h2 className="text-[19px] leading-[1.3] font-bold">Clusters</h2>
        <div className="flex-1" />
        <div className="flex min-w-45 flex-[0_1_260px] items-center gap-3">
          <Bar value={reported} max={total} tone="green" size="sm" className="flex-1" />
          <span className="shrink-0 text-[14px] font-semibold text-gray-600">
            <Mono className="text-[16px] font-bold text-gray-900">
              {reported} of {total}
            </Mono>{' '}
            reported
          </span>
        </div>
      </div>

      {/* Tablet and web: a table */}
      <div className="hidden md:block" role="table" aria-label="Clusters">
        <div
          role="row"
          className={cn(
            CLUSTER_GRID,
            'h-10 border-t border-line bg-gray-50 text-[13px] font-semibold text-gray-600',
            PAD_X
          )}
        >
          <span role="columnheader">Cluster and unit</span>
          <span role="columnheader" className="text-right">
            Reports
          </span>
          <span role="columnheader" className="text-right">
            Casualties
          </span>
          <span role="columnheader">People affected</span>
        </div>
        {done.map((c) => (
          <div
            key={c.id}
            role="row"
            className={cn('flex flex-col gap-1.5 border-t border-line py-3', PAD_X)}
          >
            <div className={CLUSTER_GRID}>
              <div role="cell" className="flex min-w-0 items-center gap-3">
                <DoneMark />
                <span className="text-[17px] leading-[1.3] font-bold">{c.name}</span>
              </div>
              <Mono className="text-right text-[16px] font-semibold">{c.reports}</Mono>
              <Mono
                className={cn(
                  'text-right text-[16px] font-semibold',
                  c.casualties ? 'text-error-700' : 'text-gray-400'
                )}
              >
                {c.casualties}
              </Mono>
              <div className="flex min-w-0 items-center gap-3">
                <Bar value={c.people} max={maxPeople} size="sm" className="flex-1" />
                <Mono className="w-12 shrink-0 text-right text-[16px] font-bold">
                  {c.people.toLocaleString()}
                </Mono>
              </div>
            </div>
            {c.units.map((u) => (
              <div key={u.name} className={CLUSTER_GRID}>
                <span className="pl-9 text-[16px] text-gray-600">{u.name}</span>
                <span />
                <span />
                <Mono className="text-right text-[14px] font-medium text-gray-600">
                  {u.people.toLocaleString()}
                </Mono>
              </div>
            ))}
          </div>
        ))}
        {pending.map((p) => (
          <div
            key={p.id}
            role="row"
            className={cn(CLUSTER_GRID, 'border-t border-line py-3', PAD_X)}
          >
            <div role="cell" className="flex min-w-0 items-center gap-3">
              <PendingMark />
              <span className="text-[17px] leading-[1.3] font-bold text-gray-600">{p.name}</span>
            </div>
            <div className="col-span-3 flex justify-end">
              <NoReportChip />
            </div>
          </div>
        ))}
        <div
          role="row"
          className={cn(
            CLUSTER_GRID,
            'min-h-12 rounded-b-[22px] border-t border-line bg-gray-50',
            PAD_X
          )}
        >
          <span className="text-[16px] font-bold">Total</span>
          <Mono className="text-right text-[17px] font-extrabold">{summary.totals.reports}</Mono>
          <Mono className="text-right text-[17px] font-extrabold text-error-700">
            {summary.totals.casualties}
          </Mono>
          <Mono className="text-right text-[17px] font-extrabold">
            {summary.totals.people.toLocaleString()}
          </Mono>
        </div>
      </div>

      {/* Phone: stacked rows */}
      <ul className="md:hidden">
        {done.map((c) => (
          <li key={c.id} className={cn('flex flex-col gap-1.5 border-t border-line py-3', PAD_X)}>
            <div className="flex items-center gap-3">
              <DoneMark />
              <div className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-[17px] leading-[1.3] font-bold">{c.name}</span>
                <span className="text-[14px] text-gray-500">
                  {plural(c.reports, 'report', 'reports')}
                  {c.casualties > 0 && ` · ${plural(c.casualties, 'casualty', 'casualties')}`}
                </span>
              </div>
              <Mono className="text-[17px] font-bold">{c.people.toLocaleString()}</Mono>
            </div>
            {c.units.map((u) => (
              <div
                key={u.name}
                className="flex items-center justify-between gap-3 pl-9 text-[16px] text-gray-600"
              >
                <span>{u.name}</span>
                <Mono className="text-[14px] font-medium">{u.people.toLocaleString()}</Mono>
              </div>
            ))}
          </li>
        ))}
        {pending.map((p) => (
          <li key={p.id} className={cn('flex items-center gap-3 border-t border-line py-3', PAD_X)}>
            <PendingMark />
            <span className="min-w-0 flex-1 text-[17px] leading-[1.3] font-bold text-gray-600">
              {p.name}
            </span>
            <NoReportChip />
          </li>
        ))}
        <li
          className={cn(
            'flex min-h-13 items-center gap-3 rounded-b-[22px] border-t border-line bg-gray-50',
            PAD_X
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[16px] font-bold">Total</span>
            <span className="text-[14px] text-gray-500">
              {plural(summary.totals.reports, 'report', 'reports')} ·{' '}
              {plural(summary.totals.casualties, 'casualty', 'casualties')}
            </span>
          </div>
          <Mono className="text-[17px] font-extrabold">
            {summary.totals.people.toLocaleString()}
          </Mono>
        </li>
      </ul>
    </Card>
  );
}

/* ─── Headcount ──────────────────────────────────────────────────────────────────────── */

export function HeadcountCard({ summary }: { summary: Summary }) {
  const [clusterId, setClusterId] = useState('');
  const reports = summary.source.reports.filter((r) => !clusterId || r.cluster_id === clusterId);
  const rows = clusterId ? headcountOf(reports) : summary.headcount.rows;
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  const half = Math.ceil(rows.length / 2);

  return (
    <Card className="flex flex-col gap-4 p-4.5 md:p-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-[19px] leading-[1.3] font-bold">Headcount</h2>
        <span className="text-[14px] font-semibold text-gray-600">
          <Mono className="text-[16px] font-bold text-gray-900">{total.toLocaleString()}</Mono>{' '}
          people
        </span>
        <div className="flex-1" />
        <FilterSelect
          label="Headcount for cluster"
          allLabel="All clusters"
          value={clusterId}
          onChange={setClusterId}
          options={summary.clusters.done.map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>
      {rows.length ? (
        <ul
          className="grid grid-cols-1 gap-x-10 gap-y-3 lg:grid-flow-col lg:grid-cols-2"
          style={{ gridTemplateRows: `repeat(${half}, auto)` }}
        >
          {rows.map((r) => (
            <li
              key={r.id}
              className="grid min-w-0 grid-cols-[112px_minmax(0,1fr)_32px_36px] items-center gap-3 md:grid-cols-[200px_minmax(0,1fr)_40px_44px] lg:grid-cols-[150px_minmax(0,1fr)_36px_40px]"
            >
              <span className="text-[14px] leading-[1.3] font-semibold text-pretty text-gray-700">
                {r.name}
              </span>
              <Bar value={r.count} max={max} />
              <Mono className="text-right text-[14px] font-bold">{r.count.toLocaleString()}</Mono>
              <Mono className="text-right text-[13px] font-medium text-gray-500">
                {total ? `${Math.round((r.count / total) * 100)}%` : '0%'}
              </Mono>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[16px] text-gray-500">No people counted yet.</p>
      )}
      <span className="border-t border-line pt-3 text-[14px] text-gray-500">
        {clusterId
          ? `${rows.length} of ${summary.headcount.fieldsTotal} fields have people counted in this cluster. Fields at 0 are not listed.`
          : `${rows.length} of ${summary.headcount.fieldsTotal} fields have people counted. Fields at 0 are not listed.`}
      </span>
    </Card>
  );
}

/* ─── Casualties and missing persons ─────────────────────────────────────────────────── */

const SHOW_FIRST = 5;

function ShowAllFooter({
  showing,
  total,
  open,
  onToggle,
  order,
}: {
  showing: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  order: string;
}) {
  if (total <= SHOW_FIRST) return null;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-b-[22px] border-t border-line bg-gray-25 py-2',
        PAD_X
      )}
    >
      <span className="text-[14px] font-medium text-gray-500">
        {open ? `Showing all ${total}${order}` : `Showing ${showing} of ${total}${order}`}
      </span>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn('text-brand-500 h-10 rounded-lg px-1 text-[16px] font-bold', FOCUS_RING)}
      >
        {open ? 'Show fewer' : `Show all ${total}`}
      </button>
    </div>
  );
}

const CAS_GRID =
  'grid items-start gap-3 md:grid-cols-[minmax(0,1.2fr)_124px_minmax(0,1.5fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.2fr)_128px_minmax(0,1.6fr)_minmax(0,1.1fr)_64px]';

export function CasualtiesCard({ summary }: { summary: Summary }) {
  const [condition, setCondition] = useState('');
  const [open, setOpen] = useState(false);
  const rows = summary.casualties.filter((c) => !condition || c.condition === condition);
  const shown = open ? rows : rows.slice(0, SHOW_FIRST);
  const conditions = summary.casualtiesByCondition.filter((c) => c.count > 0);

  return (
    <Card className="flex flex-col">
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 py-4', PAD_X)}>
        <h2 className="text-[19px] leading-[1.3] font-bold">Casualties</h2>
        <Chip tone="red" className="font-landing-mono text-[14px] font-bold">
          {summary.totals.casualties}
        </Chip>
        <div className="flex-1" />
        {conditions.length > 1 && (
          <FilterSelect
            label="Casualties with condition"
            allLabel="All conditions"
            value={condition}
            onChange={setCondition}
            options={conditions.map((c) => ({ value: c.name, label: c.name }))}
          />
        )}
      </div>
      {rows.length === 0 ? (
        <p className={cn('border-t border-line py-6 text-[16px] text-gray-500', PAD_X)}>
          No casualties reported.
        </p>
      ) : (
        <>
          <div role="table" aria-label="Casualties" className="hidden md:block">
            <div
              role="row"
              className={cn(
                CAS_GRID,
                'h-10 items-center border-t border-line bg-gray-50 text-[13px] font-semibold text-gray-600',
                PAD_X
              )}
            >
              <span role="columnheader">Person</span>
              <span role="columnheader">Condition</span>
              <span role="columnheader">What happened</span>
              <span role="columnheader">Cluster and unit</span>
              <span role="columnheader" className="hidden text-right lg:block">
                Time
              </span>
            </div>
            {shown.map((c) => (
              <div
                key={c.id}
                role="row"
                className={cn(CAS_GRID, 'border-t border-line py-3', PAD_X)}
              >
                <div role="cell" className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[16px] leading-[1.35] font-semibold">{c.name}</span>
                  <span className="text-[14px] text-gray-500">{c.who}</span>
                </div>
                <div role="cell" className="flex">
                  <Chip tone={c.level.tone}>{c.condition}</Chip>
                </div>
                <span
                  role="cell"
                  className="min-w-0 text-[16px] leading-[1.45] text-pretty text-gray-700"
                >
                  {c.diagnosis ?? '—'}
                </span>
                <div role="cell" className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[16px] leading-[1.35] font-semibold text-gray-700">
                    {c.cluster}
                  </span>
                  <span className="text-[14px] text-gray-500">{c.unit}</span>
                </div>
                <Mono className="hidden text-right text-[14px] leading-[1.6] font-medium text-gray-600 lg:block">
                  {formatTime(c.at)}
                </Mono>
              </div>
            ))}
          </div>
          <ul className="md:hidden">
            {shown.map((c) => (
              <li
                key={c.id}
                className={cn('flex flex-col gap-1.5 border-t border-line py-3.5', PAD_X)}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[17px] leading-[1.35] font-semibold">{c.name}</span>
                    <span className="text-[14px] text-gray-500">{c.who}</span>
                  </div>
                  <Chip tone={c.level.tone}>{c.condition}</Chip>
                </div>
                {c.diagnosis && (
                  <span className="text-[16px] leading-[1.45] text-pretty text-gray-700">
                    {c.diagnosis}
                  </span>
                )}
                <span className="text-[14px] leading-[1.4] text-gray-500">
                  {c.cluster} · {c.unit} · {formatTime(c.at)}
                </span>
              </li>
            ))}
          </ul>
          <ShowAllFooter
            showing={shown.length}
            total={rows.length}
            open={open}
            onToggle={() => setOpen((o) => !o)}
            order=", most severe first"
          />
        </>
      )}
    </Card>
  );
}

const MIS_GRID =
  'grid items-start gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_64px]';

export function MissingCard({ summary }: { summary: Summary }) {
  const [clusterId, setClusterId] = useState('');
  const [open, setOpen] = useState(false);
  const rows = summary.missing.filter((m) => !clusterId || m.clusterId === clusterId);
  const shown = open ? rows : rows.slice(0, SHOW_FIRST);
  const clusters = summary.clusters.done.filter((c) =>
    summary.missing.some((m) => m.clusterId === c.id)
  );

  return (
    <Card className="flex flex-col">
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 py-4', PAD_X)}>
        <h2 className="text-[19px] leading-[1.3] font-bold">Missing persons</h2>
        <Chip tone="amber" className="font-landing-mono text-[14px] font-bold">
          {summary.totals.missing}
        </Chip>
        <div className="flex-1" />
        {clusters.length > 1 && (
          <FilterSelect
            label="Missing persons in cluster"
            allLabel="All clusters"
            value={clusterId}
            onChange={setClusterId}
            options={clusters.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}
      </div>
      {rows.length === 0 ? (
        <p className={cn('border-t border-line py-6 text-[16px] text-gray-500', PAD_X)}>
          No missing persons reported.
        </p>
      ) : (
        <>
          <div role="table" aria-label="Missing persons" className="hidden md:block">
            <div
              role="row"
              className={cn(
                MIS_GRID,
                'h-10 items-center border-t border-line bg-gray-50 text-[13px] font-semibold text-gray-600',
                PAD_X
              )}
            >
              <span role="columnheader">Person</span>
              <span role="columnheader">Last seen</span>
              <span role="columnheader">Reported by</span>
              <span role="columnheader" className="hidden text-right lg:block">
                Time
              </span>
            </div>
            {shown.map((m) => (
              <div
                key={m.id}
                role="row"
                className={cn(MIS_GRID, 'border-t border-line py-3', PAD_X)}
              >
                <div role="cell" className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[16px] leading-[1.35] font-semibold">{m.name}</span>
                  <span className="text-[14px] text-gray-500">{m.who}</span>
                </div>
                <div role="cell" className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[16px] leading-[1.35] font-semibold text-gray-700">
                    {m.cluster}
                  </span>
                  <span className="text-[14px] text-gray-500">{m.unit}</span>
                </div>
                <span role="cell" className="min-w-0 text-[16px] leading-[1.45] text-gray-700">
                  {m.reportedBy}
                </span>
                <Mono className="hidden text-right text-[14px] leading-[1.6] font-medium text-gray-600 lg:block">
                  {formatTime(m.at)}
                </Mono>
              </div>
            ))}
          </div>
          <ul className="md:hidden">
            {shown.map((m) => (
              <li
                key={m.id}
                className={cn('flex flex-col gap-1.5 border-t border-line py-3.5', PAD_X)}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[17px] leading-[1.35] font-semibold">{m.name}</span>
                  <span className="text-[14px] text-gray-500">{m.who}</span>
                </div>
                <span className="text-[16px] leading-[1.4] font-semibold text-gray-700">
                  {m.cluster} · {m.unit}
                </span>
                <span className="text-[14px] leading-[1.4] text-gray-500">
                  Reported by {m.reportedBy} · {formatTime(m.at)}
                </span>
              </li>
            ))}
          </ul>
          <ShowAllFooter
            showing={shown.length}
            total={rows.length}
            open={open}
            onToggle={() => setOpen((o) => !o)}
            order=""
          />
        </>
      )}
    </Card>
  );
}

/* ─── Analytics ──────────────────────────────────────────────────────────────────────── */

function ChartCard({
  title,
  subtitle,
  legend,
  children,
}: {
  title: string;
  subtitle: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4.5 p-4.5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="text-[18px] leading-[1.3] font-bold">{title}</h3>
          <span className="text-[14px] leading-[1.4] text-gray-500">{subtitle}</span>
        </div>
        {legend}
      </div>
      {children}
    </Card>
  );
}

const startLabel = (s: Summary) => (s.start ? formatTime(s.start) : 'first report');

export function ReportsReceivedChart({
  summary,
  compare,
}: {
  summary: Summary;
  compare?: Summary;
}) {
  const scale = timelineScale(compare ? [summary, compare] : [summary]);
  const labels = timelineLabels(summary, scale);
  const a = timelineOf(summary, scale);
  const b = compare ? timelineOf(compare, scale) : null;
  const milestones = timelineMilestones(summary);
  const per =
    scale.binMinutes >= 1440
      ? 'day'
      : scale.binMinutes >= 60
        ? `${scale.binMinutes / 60} h`
        : `${scale.binMinutes} minutes`;
  return (
    <ChartCard
      title="Reports received"
      subtitle={`Per ${per} from the ${startLabel(summary)} start`}
      legend={compare && <SeriesLegend a={shortLabel(summary)} b={shortLabel(compare)} />}
    >
      <ColumnChart
        label="Reports received over time"
        labels={labels}
        series={
          b
            ? [
                { values: a, color: SERIES.a },
                { values: b, color: SERIES.b },
              ]
            : [{ values: a, color: SERIES.a }]
        }
      />
      {!compare && (
        <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3.5">
          {[
            ['First report', milestones.first],
            ['Half received by', milestones.half],
            ['Last report', milestones.last],
          ].map(([label, value]) => (
            <div key={label} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-[13px] leading-[1.3] font-medium text-gray-500">{label}</dt>
              <dd className="font-landing-mono text-[17px] font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </ChartCard>
  );
}

export function FirstReportChart({ summary, compare }: { summary: Summary; compare?: Summary }) {
  const max = firstReportScale(compare ? [summary, compare] : [summary]);
  const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((max / 4) * i));
  const other = new Map(compare?.firstReport.map((r) => [r.name, r.minutes]));
  const label = (m: number | null | undefined) =>
    m === null ? 'No report' : m === undefined ? '—' : `${m} min`;
  return (
    <ChartCard
      title="Time to first report"
      subtitle={
        compare
          ? `Minutes after the ${startLabel(summary)} start, by cluster`
          : `Minutes after the ${startLabel(summary)} start, fastest first`
      }
      legend={compare && <SeriesLegend a={shortLabel(summary)} b={shortLabel(compare)} />}
    >
      {summary.firstReport.length ? (
        <RankedBars
          max={max}
          axis={{ ticks, unit: 'min' }}
          rows={summary.firstReport.map((r) => ({
            key: r.id,
            name: r.name,
            values: [
              {
                value: r.minutes,
                label: label(r.minutes),
                color: SERIES.a,
                muted: r.minutes === null,
              },
              ...(compare
                ? [
                    {
                      value: other.get(r.name) ?? null,
                      label: label(other.get(r.name)),
                      color: SERIES.b,
                    },
                  ]
                : []),
            ],
          }))}
        />
      ) : (
        <p className="text-[16px] text-gray-500">No clusters at this campus yet.</p>
      )}
    </ChartCard>
  );
}

export function AnalyticsGrid({ summary }: { summary: Summary }) {
  const { totals, damage } = summary;
  const units = new Set(summary.casualties.map((c) => `${c.cluster}/${c.unit}`)).size;
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <ReportsReceivedChart summary={summary} />
      <FirstReportChart summary={summary} />
      <ChartCard
        title="Casualties by condition"
        subtitle={
          totals.casualties
            ? `${plural(totals.casualties, 'person', 'people')} in ${plural(units, 'unit', 'units')}`
            : 'No casualties reported'
        }
      >
        <Donut rows={summary.casualtiesByCondition} total={totals.casualties} unit="casualties" />
      </ChartCard>
      <ChartCard
        title="Structural damage"
        subtitle={`${plural(damage.unitsReported, 'unit', 'units')} reported · ${damage.withDamage.length} with damage`}
      >
        <DamageChart rows={damage.byCondition} withDamage={damage.withDamage} />
      </ChartCard>
    </div>
  );
}

/* ─── Compare with last drill ────────────────────────────────────────────────────────── */

const CHANGE_TONES = {
  good: 'bg-success-50 text-success-700',
  bad: 'bg-error-50 text-error-700',
  same: 'bg-gray-100 text-gray-600',
};

function ChangeChip({ row }: { row: CompareRow }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap',
        CHANGE_TONES[row.tone]
      )}
    >
      {row.change}
    </span>
  );
}

const CMP_GRID = 'grid grid-cols-[minmax(0,1.6fr)_112px_112px_minmax(0,1fr)] items-center gap-4';

export function CompareCard({
  summary,
  compare,
  rows,
  description,
}: {
  summary: Summary;
  compare: Summary;
  rows: CompareRow[];
  description: string;
}) {
  const a = shortLabel(summary);
  const b = shortLabel(compare);
  return (
    <Card className="flex flex-col">
      <div className={cn('flex flex-col gap-0.5 py-4', PAD_X)}>
        <h2 className="text-[19px] leading-[1.3] font-bold">
          Compared with {compare.source.event.name}
        </h2>
        <span className="text-[14px] leading-[1.4] text-gray-500">{description}</span>
      </div>
      <div
        role="table"
        aria-label={`Compared with ${compare.source.event.name}`}
        className="hidden md:block"
      >
        <div
          role="row"
          className={cn(
            CMP_GRID,
            'h-10 border-t border-line bg-gray-50 text-[13px] font-semibold text-gray-600',
            PAD_X
          )}
        >
          <span role="columnheader">Measure</span>
          <span role="columnheader" className="text-right">
            {a}
          </span>
          <span role="columnheader" className="text-right">
            {b}
          </span>
          <span role="columnheader">Change</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.measure}
            role="row"
            className={cn(CMP_GRID, 'min-h-12 border-t border-line py-2', PAD_X)}
          >
            <span role="cell" className="text-[16px] leading-[1.35] font-semibold">
              {row.measure}
            </span>
            <Mono className="text-right text-[16px] font-bold">{row.a}</Mono>
            <Mono className="text-right text-[16px] font-medium text-gray-600">{row.b}</Mono>
            <div role="cell" className="flex min-w-0">
              <ChangeChip row={row} />
            </div>
          </div>
        ))}
      </div>
      <ul className="md:hidden">
        {rows.map((row) => (
          <li
            key={row.measure}
            className={cn('flex flex-col gap-1.5 border-t border-line py-3', PAD_X)}
          >
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-[17px] leading-[1.35] font-semibold">{row.measure}</span>
              <ChangeChip row={row} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-gray-500">
              <span>
                {a} <Mono className="text-[16px] font-bold text-gray-900">{row.a}</Mono>
              </span>
              <span>
                {b} <Mono className="text-[16px] font-semibold text-gray-600">{row.b}</Mono>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
