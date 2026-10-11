'use client';

import { Button } from '@/components/ds';
import { useEvents } from '@/components/hooks/use-events';
import { useDeleteReport, useReports } from '@/components/hooks/use-reports';
import { useSettingsTable } from '@/components/hooks/use-settings';
import { totalPopulationCount } from '@/lib/utils';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../_components/confirm-dialog';
import {
  DataTable,
  FilterSelect,
  IconAction,
  ListCard,
  ListCount,
  ListToolbar,
  MobileCard,
  NameCell,
  NumberCell,
  Pager,
  RowActions,
  SearchField,
  type Column,
} from '../_components/data-list';
import { PageHeader } from '../_components/page-header';
import { useScopedCampusId } from '../_components/shell/campus-switcher';
import { Card, Chip } from '../_components/ui';
import { formatDate, formatTime, personName, plural } from '../_lib/format';
import { useDebounced } from '../_lib/use-debounced';
import { ReportDrawer } from './_components/report-drawer';

type ReportRow = NonNullable<ReturnType<typeof useReports>['data']>['data'][number];

/** Above zero: a red (casualties) or amber (missing) count chip; zero stays grey. */
function CountChip({ value, tone }: { value: number; tone: 'red' | 'amber' }) {
  return value > 0 ? (
    <Chip tone={tone} className="font-landing-mono">
      {value}
    </Chip>
  ) : (
    <NumberCell value={0} />
  );
}

const placeOf = (r: ReportRow) => [r.cluster.name, r.unit?.name].filter(Boolean).join(' · ');

export default function ReportsPage() {
  const campusId = useScopedCampusId();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const [eventId, setEventId] = useState('');
  const [clusterId, setClusterId] = useState('');
  const [page, setPage] = useState(1);
  const { data, isPending, isFetching, error } = useReports(
    page,
    debounced,
    campusId || undefined,
    {
      eventId: eventId || undefined,
      clusterId: clusterId || undefined,
    }
  );
  const { data: events = [] } = useEvents(undefined, campusId || undefined);
  const { data: clusters = [] } = useSettingsTable('clusters');
  const deleteReport = useDeleteReport();
  const [drawer, setDrawer] = useState<{ open: boolean; reportId?: string }>({ open: false });
  const [deleting, setDeleting] = useState<ReportRow | null>(null);

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (data?.perPage ?? 10)));
  const clusterOptions = (clusters as { id: string; name: string; campus_id: string }[])
    .filter((c) => !campusId || c.campus_id === campusId)
    .map((c) => ({ value: c.id, label: c.name }));

  // Filters and search start again from page 1.
  const resetPage =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const columns: Column<ReportRow>[] = [
    {
      key: 'submitted',
      header: 'Submitted',
      width: 'minmax(0,1fr)',
      cell: (r) => (
        <NameCell
          muted
          primary={formatDate(r.submitted_at)}
          secondary={formatTime(r.submitted_at)}
        />
      ),
    },
    {
      key: 'by',
      header: 'Reported by',
      width: 'minmax(0,1.4fr)',
      cell: (r) => (
        <NameCell primary={personName(r.user) || 'Unknown reporter'} secondary={placeOf(r)} />
      ),
    },
    {
      key: 'event',
      header: 'Event',
      width: 'minmax(0,1.4fr)',
      hideOnTablet: true,
      cell: (r) => <NameCell muted primary={r.event.name} secondary={r.event.campus.name} />,
    },
    {
      key: 'affected',
      header: 'Affected',
      width: '68px',
      align: 'right',
      cell: (r) => <NumberCell value={totalPopulationCount(r.population_counts)} />,
    },
    {
      key: 'casualties',
      header: 'Casualties',
      width: '76px',
      align: 'right',
      cell: (r) => <CountChip value={r._count.casualties} tone="red" />,
    },
    {
      key: 'missing',
      header: 'Missing',
      width: '64px',
      align: 'right',
      cell: (r) => <CountChip value={r._count.missing_persons} tone="amber" />,
    },
    {
      key: 'actions',
      header: '',
      width: '72px',
      align: 'right',
      cell: (r) => (
        <RowActions>
          <IconAction
            label="Edit"
            icon={<Pencil size={18} aria-hidden />}
            onClick={() => setDrawer({ open: true, reportId: r.id })}
          />
          <IconAction
            label="Delete"
            icon={<Trash2 size={18} aria-hidden />}
            onClick={() => setDeleting(r)}
          />
        </RowActions>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Status reports submitted by ERT members."
        actions={
          <Button size="sm" onClick={() => setDrawer({ open: true })}>
            <Plus size={16} aria-hidden />
            Add report
          </Button>
        }
      />

      {error ? (
        <Card className="p-6 text-[15px] text-[#b42318]">
          The reports couldn&apos;t be loaded: {error.message}
        </Card>
      ) : (
        <ListCard>
          <ListToolbar>
            <SearchField
              label="Search reports"
              placeholder="Search by name, cluster or unit…"
              value={query}
              onChange={resetPage(setQuery)}
            />
            <FilterSelect
              label="Event"
              allLabel="All events"
              value={eventId}
              onChange={resetPage(setEventId)}
              options={events.map((e) => ({
                value: e.id,
                label: campusId ? e.name : `${e.name} — ${e.campus.name}`,
              }))}
            />
            <FilterSelect
              label="Cluster"
              allLabel="All clusters"
              value={clusterId}
              onChange={resetPage(setClusterId)}
              options={clusterOptions}
            />
            <ListCount>{plural(total, 'report', 'reports')}</ListCount>
          </ListToolbar>
          <DataTable
            label="Reports"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            loading={isPending || (isFetching && !rows.length)}
            empty={
              debounced || eventId || clusterId
                ? 'No reports match these filters.'
                : 'No reports yet.'
            }
            card={(r) => (
              <MobileCard
                title={personName(r.user) || 'Unknown reporter'}
                subtitle={placeOf(r)}
                aside={`${formatDate(r.submitted_at).replace(/, \d{4}$/, '')} · ${formatTime(r.submitted_at)}`}
                meta={[
                  { label: 'Event', value: `${r.event.name} — ${r.event.campus.name}` },
                  {
                    label: 'Affected',
                    value: totalPopulationCount(r.population_counts).toLocaleString(),
                  },
                  {
                    label: 'Casualties',
                    value: r._count.casualties,
                    tone: r._count.casualties ? 'red' : 'muted',
                  },
                  {
                    label: 'Missing',
                    value: r._count.missing_persons,
                    tone: r._count.missing_persons ? 'amber' : 'muted',
                  },
                ]}
                actions={[
                  {
                    label: 'Edit',
                    icon: <Pencil size={16} aria-hidden />,
                    onClick: () => setDrawer({ open: true, reportId: r.id }),
                  },
                  {
                    label: 'Delete',
                    icon: <Trash2 size={16} aria-hidden />,
                    onClick: () => setDeleting(r),
                    variant: 'danger',
                  },
                ]}
              />
            )}
          />
          <Pager page={page} totalPages={totalPages} onChange={setPage} />
        </ListCard>
      )}

      <ReportDrawer
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        reportId={drawer.reportId}
        campusId={campusId || undefined}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          deleteReport.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Report deleted');
              setDeleting(null);
            },
            onError: (err) => toast.error(err.message),
          })
        }
        loading={deleteReport.isPending}
        tone="danger"
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this report?"
        name={deleting ? `${personName(deleting.user) || 'Unknown reporter'}'s report` : ''}
        body={
          deleting
            ? `for ${deleting.event.name} — ${deleting.event.campus.name} will be permanently deleted. This cannot be undone.`
            : ''
        }
        warning={
          deleting && deleting._count.casualties + deleting._count.missing_persons > 0
            ? `Its ${plural(deleting._count.casualties, 'casualty', 'casualties')} and ${plural(deleting._count.missing_persons, 'missing person', 'missing persons')} are deleted with it.`
            : undefined
        }
        confirmLabel="Delete report"
      />
    </>
  );
}
