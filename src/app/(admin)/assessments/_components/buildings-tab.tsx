'use client';

import { FOCUS_RING } from '@/components/ds';
import { useBuildingSummaries } from '@/components/hooks/use-assessments';
import { cn } from '@/lib';
import { percent, recoveryStatus } from '@/lib/assessment-score';
import type { BuildingScores } from '@/lib/assessment-template';
import { placeLine } from '@/lib/building-place';
import { ChartLine, Eye } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  DataTable,
  FilterSelect,
  IconAction,
  ListCount,
  ListToolbar,
  MobileCard,
  NameCell,
  Pager,
  RowActions,
  SearchField,
  TextCell,
  type Column,
} from '../../_components/data-list';
import { useScopedCampusId } from '../../_components/shell/campus-switcher';
import { Chip, EmptyNote } from '../../_components/ui';
import { formatDate, plural } from '../../_lib/format';
import { clusterOptions, filterByCategory } from '../_lib/category-filter';
import { CategorySelect, useCategory } from './category-select';
import { RECOVERY_TEXT, RecoveryCell, ScoreCell } from './score-cell';

const PAGE_SIZE = 10;

const detailHref = (id: string) => `/assessments/details?id=${id}`;

/** The Assessments → Compare tab for this building (its history and A/B compare). */
const compareHref = (b: BuildingScores) =>
  `/assessments?tab=compare&building=${b.id}${b.category === 'off_campus' ? '&category=off_campus' : ''}`;

/**
 * The Buildings tab's quick filters (DRRM-042): the to-do list one click away. `?filter=` opens
 * one (the dashboard's "buildings need structural follow-up" links to `follow-up`).
 */
const QUICK = [
  { key: 'follow-up', label: 'Needs follow-up' },
  { key: 'not-assessed', label: 'Not yet assessed' },
  { key: 'stale', label: 'Not assessed in 6 months' },
] as const;
type Quick = (typeof QUICK)[number]['key'];

const SIX_MONTHS_MS = 182 * 24 * 60 * 60 * 1000;

function matchesQuick(b: BuildingScores, quick: Quick, now: number) {
  if (quick === 'follow-up') return !!b.latest?.needs_follow_up;
  if (quick === 'not-assessed') return !b.latest;
  return !!b.latest && now - new Date(b.latest.ended_at).getTime() > SIX_MONTHS_MS;
}

const PILLAR_COLUMNS = [
  ['prevention-mitigation', 'Prevention'],
  ['preparedness', 'Preparedness'],
  ['response', 'Response'],
] as const;

/** Each active building with its latest assessment's scores and the change since the one before. */
export function BuildingsTab() {
  const campusId = useScopedCampusId();
  const { data = [], isPending, error } = useBuildingSummaries(campusId);
  const [query, setQuery] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [page, setPage] = useState(1);
  const [category, setCategory] = useCategory();
  const initial = useSearchParams().get('filter');
  const [quick, setQuick] = useState<Quick | null>(
    QUICK.some((q) => q.key === initial) ? (initial as Quick) : null
  );
  const now = Date.now();

  if (error) return <EmptyNote>The buildings couldn&apos;t be loaded: {error.message}</EmptyNote>;

  const reset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const inCategory = filterByCategory(data, category);
  const clusters = clusterOptions(inCategory);
  const q = query.trim().toLowerCase();
  const searched = inCategory.filter(
    (b) =>
      (!clusterId || b.cluster?.id === clusterId) &&
      (!q || b.name.toLowerCase().includes(q) || b.label.toLowerCase().includes(q))
  );
  const rows = quick ? searched.filter((b) => matchesQuick(b, quick, now)) : searched;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const shown = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const notYet = <TextCell>Not yet assessed</TextCell>;
  const columns: Column<BuildingScores>[] = [
    {
      key: 'building',
      header: 'Building',
      width: 'minmax(0,1.6fr)',
      cell: (b) => (
        <NameCell
          primary={b.name}
          secondary={b.label}
          // The building: its assessments over time and Compare.
          href={b.latest ? compareHref(b) : undefined}
        />
      ),
    },
    {
      key: 'cluster',
      header: 'Cluster',
      width: 'minmax(0,1fr)',
      hideOnTablet: true,
      cell: (b) => <TextCell>{b.cluster?.name ?? '—'}</TextCell>,
    },
    {
      key: 'overall',
      header: 'Overall',
      width: 'minmax(84px,0.7fr)',
      cell: (b) =>
        b.latest ? <ScoreCell tally={b.latest.overall} previous={b.previous?.overall} /> : notYet,
    },
    ...PILLAR_COLUMNS.map(([code, header]) => ({
      key: code,
      header,
      width: 'minmax(84px,0.7fr)',
      hideOnTablet: true,
      cell: (b: BuildingScores) =>
        b.latest ? (
          <ScoreCell tally={b.latest.pillars[code]} previous={b.previous?.pillars[code]} />
        ) : null,
    })),
    {
      key: 'pscp',
      header: 'PSCP',
      width: 'minmax(72px,0.6fr)',
      hideOnTablet: true,
      cell: (b) =>
        b.latest ? <RecoveryCell tally={b.latest.pillars['rehabilitation-recovery']} /> : null,
    },
    {
      key: 'last',
      header: 'Last assessed',
      width: 'minmax(0,0.9fr)',
      cell: (b) =>
        b.latest ? (
          <span className="flex flex-col gap-0.5">
            <TextCell>{formatDate(b.latest.ended_at)}</TextCell>
            {b.latest.needs_follow_up && (
              <Chip tone="amber" dot>
                Follow-up
              </Chip>
            )}
          </span>
        ) : null,
    },
    {
      key: 'evaluator',
      header: 'Evaluator',
      width: 'minmax(0,1fr)',
      hideOnTablet: true,
      cell: (b) => <TextCell>{b.latest?.evaluator_name || '—'}</TextCell>,
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      align: 'right',
      cell: (b) =>
        b.latest ? (
          <RowActions>
            <IconAction
              label={`Compare ${b.name}'s assessments`}
              icon={<ChartLine size={18} aria-hidden />}
              href={compareHref(b)}
            />
          </RowActions>
        ) : null,
    },
  ];

  return (
    <>
      <ListToolbar>
        <SearchField
          label="Search buildings"
          placeholder="Search buildings…"
          value={query}
          onChange={reset(setQuery)}
        />
        <CategorySelect
          value={category}
          onChange={(next) => {
            setClusterId('');
            setPage(1);
            setCategory(next);
          }}
        />
        {category !== 'off_campus' && (
          <FilterSelect
            label="Cluster"
            allLabel="All clusters"
            value={clusterId}
            onChange={reset(setClusterId)}
            options={clusters.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}
        <ListCount loading={isPending}>{plural(rows.length, 'building', 'buildings')}</ListCount>
      </ListToolbar>
      <div
        role="group"
        aria-label="Quick filters"
        className="flex flex-wrap gap-2 px-4 pb-3 md:px-5"
      >
        {QUICK.map((f) => {
          const on = quick === f.key;
          const count = searched.filter((b) => matchesQuick(b, f.key, now)).length;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setQuick(on ? null : f.key);
                setPage(1);
              }}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full border-[1.5px] px-3.5 text-[14px] font-bold whitespace-nowrap transition-colors duration-120 ease-out',
                on
                  ? 'border-brand-500 bg-brand-25 text-brand-500'
                  : 'border-gray-300 bg-surface text-gray-900 hover:border-gray-400 hover:bg-hover',
                FOCUS_RING
              )}
            >
              {f.label}
              <span
                className={cn(
                  'font-landing-mono grid h-5.5 min-w-5.5 place-items-center rounded-full px-1.5 text-[12px]',
                  on ? 'bg-surface text-brand-500' : 'bg-gray-100 text-gray-600'
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <DataTable
        label="Buildings"
        columns={columns}
        rows={shown}
        rowKey={(b) => b.id}
        // The row opens the building (its history and Compare); not yet assessed opens nothing.
        rowHref={(b) => (b.latest ? compareHref(b) : '')}
        loading={isPending}
        empty={
          quick
            ? `No buildings ${QUICK.find((f) => f.key === quick)!.label.toLowerCase()}.`
            : query
              ? `No buildings match “${query}”.`
              : 'No buildings yet. ERT members add them when they assess one.'
        }
        card={(b) => (
          <MobileCard
            title={b.name}
            subtitle={placeLine(b)}
            chip={
              b.latest?.needs_follow_up ? (
                <Chip tone="amber" dot>
                  Follow-up
                </Chip>
              ) : undefined
            }
            meta={
              b.latest
                ? [
                    {
                      label: 'Overall',
                      value:
                        percent(b.latest.overall) === null ? '—' : `${percent(b.latest.overall)}%`,
                    },
                    {
                      label: 'PSCP',
                      value:
                        RECOVERY_TEXT[recoveryStatus(b.latest.pillars['rehabilitation-recovery'])],
                    },
                    { label: 'Last assessed', value: formatDate(b.latest.ended_at) },
                  ]
                : [{ label: 'Status', value: 'Not yet assessed', tone: 'muted' as const }]
            }
            actions={
              b.latest
                ? [
                    {
                      label: 'Open latest',
                      href: detailHref(b.latest.id),
                      icon: <Eye size={16} aria-hidden />,
                    },
                    {
                      label: 'Compare',
                      href: compareHref(b),
                      icon: <ChartLine size={16} aria-hidden />,
                    },
                  ]
                : undefined
            }
          />
        )}
      />
      <Pager page={current} totalPages={totalPages} onChange={setPage} />
    </>
  );
}
