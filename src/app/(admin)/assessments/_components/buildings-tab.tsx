'use client';

import { useBuildingSummaries } from '@/components/hooks/use-assessments';
import { percent, recoveryStatus } from '@/lib/assessment-score';
import type { BuildingScores } from '@/lib/assessment-template';
import { ChartLine, Eye } from 'lucide-react';
import { useState } from 'react';
import {
  DataTable,
  FilterSelect,
  IconAction,
  ListCount,
  ListToolbar,
  MobileCard,
  NameCell,
  RowActions,
  SearchField,
  TextCell,
  type Column,
} from '../../_components/data-list';
import { useScopedCampusId } from '../../_components/shell/campus-switcher';
import { Chip, EmptyNote } from '../../_components/ui';
import { formatDate, plural } from '../../_lib/format';
import { RECOVERY_TEXT, RecoveryCell, ScoreCell } from './score-cell';

const detailHref = (id: string) => `/assessments/details?id=${id}`;

/** The dashboard's Building safety section at this building (its history and A/B compare). */
const compareHref = (b: BuildingScores) =>
  `/dashboard?${new URLSearchParams({
    bs_campus: b.campus.id,
    bs_cluster: b.cluster.id,
    bs_unit: b.unit.id,
    bs_building: b.id,
  })}#building-safety`;

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

  if (error) return <EmptyNote>The buildings couldn&apos;t be loaded: {error.message}</EmptyNote>;

  const clusters = [...new Map(data.map((b) => [b.cluster.id, b.cluster])).values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const q = query.trim().toLowerCase();
  const rows = data.filter(
    (b) =>
      (!clusterId || b.cluster.id === clusterId) &&
      (!q || b.name.toLowerCase().includes(q) || b.unit.name.toLowerCase().includes(q))
  );

  const notYet = <TextCell>Not yet assessed</TextCell>;
  const columns: Column<BuildingScores>[] = [
    {
      key: 'building',
      header: 'Building',
      width: 'minmax(0,1.6fr)',
      cell: (b) => (
        <NameCell
          primary={b.name}
          secondary={b.unit.name}
          href={b.latest ? detailHref(b.latest.id) : undefined}
        />
      ),
    },
    {
      key: 'cluster',
      header: 'Cluster',
      width: 'minmax(0,1fr)',
      hideOnTablet: true,
      cell: (b) => <TextCell>{b.cluster.name}</TextCell>,
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
          onChange={setQuery}
        />
        <FilterSelect
          label="Cluster"
          allLabel="All clusters"
          value={clusterId}
          onChange={setClusterId}
          options={clusters.map((c) => ({ value: c.id, label: c.name }))}
        />
        <ListCount loading={isPending}>{plural(rows.length, 'building', 'buildings')}</ListCount>
      </ListToolbar>
      <DataTable
        label="Buildings"
        columns={columns}
        rows={rows}
        rowKey={(b) => b.id}
        loading={isPending}
        empty={
          query
            ? `No buildings match “${query}”.`
            : 'No buildings yet. ERT members add them when they assess one.'
        }
        card={(b) => (
          <MobileCard
            title={b.name}
            subtitle={`${b.unit.name} · ${b.cluster.name}`}
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
    </>
  );
}
