'use client';

import { FOCUS_RING } from '@/components/ds';
import { useAssessmentList } from '@/components/hooks/use-assessments';
import { cn } from '@/lib';
import { percent } from '@/lib/assessment-score';
import type { AdminAssessmentRow } from '@/lib/assessment-template';
import { Eye } from 'lucide-react';
import { useState } from 'react';
import {
  DataTable,
  FilterSelect,
  ListCount,
  ListToolbar,
  MobileCard,
  NameCell,
  Pager,
  SearchField,
  TextCell,
  type Column,
} from '../../_components/data-list';
import { useScopedCampusId } from '../../_components/shell/campus-switcher';
import { Chip, EmptyNote } from '../../_components/ui';
import { formatDate, plural } from '../../_lib/format';
import { ScoreCell } from './score-cell';

const PAGE_SIZE = 20;

const detailHref = (id: string) => `/assessments/details?id=${id}`;

/** A day filter ("From", "To") styled like FilterSelect. */
function DateFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-11 shrink-0 items-center gap-2 rounded-[14px] border border-gray-300 bg-surface pr-2 pl-3.5 text-[14px] font-medium text-gray-600 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#5a9ef2]">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-full bg-transparent text-[15px] text-gray-900 outline-none', FOCUS_RING)}
      />
    </label>
  );
}

/** "2026-10-21" as a local day, compared with an assessment's end. */
const dayOf = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Every submission in scope, newest first, filtered and paged here. */
export function AssessmentsTab() {
  const campusId = useScopedCampusId();
  const { data = [], isPending, error } = useAssessmentList(campusId);
  const [query, setQuery] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  if (error) return <EmptyNote>The assessments couldn&apos;t be loaded: {error.message}</EmptyNote>;

  const reset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };
  const unique = (list: { id: string; name: string }[]) =>
    [...new Map(list.map((x) => [x.id, x])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const clusters = unique(data.map((r) => r.cluster));
  const units = unique(
    data.filter((r) => !clusterId || r.cluster.id === clusterId).map((r) => r.unit)
  );

  const q = query.trim().toLowerCase();
  const rows = data.filter((r) => {
    const day = dayOf(r.ended_at);
    return (
      (!clusterId || r.cluster.id === clusterId) &&
      (!unitId || r.unit.id === unitId) &&
      (!from || day >= from) &&
      (!to || day <= to) &&
      (!q ||
        r.building.name.toLowerCase().includes(q) ||
        r.evaluator_name.toLowerCase().includes(q))
    );
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const columns: Column<AdminAssessmentRow>[] = [
    {
      key: 'building',
      header: 'Building',
      width: 'minmax(0,1.5fr)',
      cell: (r) => (
        <NameCell primary={r.building.name} secondary={r.unit.name} href={detailHref(r.id)} />
      ),
    },
    {
      key: 'cluster',
      header: 'Cluster',
      width: 'minmax(0,1fr)',
      hideOnTablet: true,
      cell: (r) => <TextCell>{r.cluster.name}</TextCell>,
    },
    {
      key: 'date',
      header: 'Date',
      width: 'minmax(0,0.8fr)',
      cell: (r) => <TextCell>{formatDate(r.ended_at)}</TextCell>,
    },
    {
      key: 'evaluator',
      header: 'Evaluator',
      width: 'minmax(0,1fr)',
      cell: (r) => <TextCell>{r.evaluator_name || '—'}</TextCell>,
    },
    {
      key: 'event',
      header: 'Event',
      width: 'minmax(0,1fr)',
      hideOnTablet: true,
      cell: (r) => <TextCell>{r.event_name ?? '—'}</TextCell>,
    },
    {
      key: 'overall',
      header: 'Overall',
      width: 'minmax(72px,0.6fr)',
      cell: (r) => <ScoreCell tally={r.overall} />,
    },
    {
      key: 'flag',
      header: '',
      width: 'minmax(96px,0.7fr)',
      cell: (r) =>
        r.needs_follow_up ? (
          <Chip tone="amber" dot>
            Follow-up
          </Chip>
        ) : null,
    },
  ];

  return (
    <>
      <ListToolbar>
        <SearchField
          label="Search assessments"
          placeholder="Search building or evaluator…"
          value={query}
          onChange={reset(setQuery)}
        />
        <FilterSelect
          label="Cluster"
          allLabel="All clusters"
          value={clusterId}
          onChange={(v) => {
            reset(setClusterId)(v);
            setUnitId('');
          }}
          options={clusters.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          label="Unit"
          allLabel="All units"
          value={unitId}
          onChange={reset(setUnitId)}
          options={units.map((u) => ({ value: u.id, label: u.name }))}
        />
        <DateFilter label="From" value={from} onChange={reset(setFrom)} />
        <DateFilter label="To" value={to} onChange={reset(setTo)} />
        <ListCount loading={isPending}>
          {plural(rows.length, 'assessment', 'assessments')}
        </ListCount>
      </ListToolbar>
      <DataTable
        label="Assessments"
        columns={columns}
        rows={shown}
        rowKey={(r) => r.id}
        loading={isPending}
        empty={data.length === 0 ? 'No assessments yet.' : 'No assessments match these filters.'}
        card={(r) => {
          const p = percent(r.overall);
          return (
            <MobileCard
              title={r.building.name}
              subtitle={`${r.unit.name} · ${r.cluster.name}`}
              chip={
                r.needs_follow_up ? (
                  <Chip tone="amber" dot>
                    Follow-up
                  </Chip>
                ) : undefined
              }
              meta={[
                { label: 'Date', value: formatDate(r.ended_at) },
                { label: 'Overall', value: p === null ? '—' : `${p}%` },
                { label: 'Evaluator', value: r.evaluator_name || '—' },
              ]}
              actions={[
                { label: 'Open', href: detailHref(r.id), icon: <Eye size={16} aria-hidden /> },
              ]}
            />
          );
        }}
      />
      <Pager page={current} totalPages={totalPages} onChange={setPage} />
    </>
  );
}
