'use client';

import { Button } from '@/components/ds';
import { useCampuses } from '@/components/hooks/use-campus';
import { useEvents } from '@/components/hooks/use-events';
import { Download, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DataTable,
  IconAction,
  ListCard,
  ListCount,
  ListTabs,
  ListToolbar,
  MobileCard,
  NameCell,
  NumberCell,
  RowActions,
  SearchField,
  TextCell,
  type Column,
} from '../_components/data-list';
import { PageHeader } from '../_components/page-header';
import { useEventTitle, useScopedCampusId } from '../_components/shell/campus-switcher';
import { Card, Chip } from '../_components/ui';
import { formatDate, formatTime, plural } from '../_lib/format';
import { capitalize, eventStatusKey, eventTone, type EventStatus } from '../_lib/status';
import { useDebounced } from '../_lib/use-debounced';
import { DeleteEventDialog, type DeletableEvent } from './_components/delete-event-dialog';
import { EventDrawer } from './_components/event-drawer';
import { exportEventToExcel } from './export-event';

type EventRow = NonNullable<ReturnType<typeof useEvents>['data']>[number];
type Tab = 'all' | EventStatus;

export default function EventsPage() {
  return (
    <Suspense>
      <Events />
    </Suspense>
  );
}

function Events() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campusId = useScopedCampusId();
  const eventTitle = useEventTitle();
  const { data: campuses = [] } = useCampuses();
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const { data: events = [], isPending, error } = useEvents(debounced, campusId || undefined);
  const [tab, setTab] = useState<Tab>('all');
  const [drawer, setDrawer] = useState<{ open: boolean; eventId?: string }>({ open: false });
  const [deleting, setDeleting] = useState<DeletableEvent | null>(null);
  const [exportingId, setExportingId] = useState('');

  // The dashboard's Add event lands here with ?add=1.
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setDrawer({ open: true });
      router.replace('/events');
    }
  }, [searchParams, router]);

  const allCampuses = !campusId;
  const campusName = campuses.find((c) => c.id === campusId)?.name;
  const counts = { all: events.length, ongoing: 0, upcoming: 0, completed: 0 };
  for (const e of events) {
    const key = eventStatusKey(e.status.name);
    if (key !== 'other') counts[key]++;
  }
  const rows = tab === 'all' ? events : events.filter((e) => eventStatusKey(e.status.name) === tab);

  const exportExcel = async (event: EventRow) => {
    setExportingId(event.id);
    const toastId = toast.loading('Preparing the Excel file…');
    try {
      await exportEventToExcel(event.id);
      toast.success('Excel file downloaded', { id: toastId });
    } catch {
      toast.error('The event could not be exported. Please try again.', { id: toastId });
    } finally {
      setExportingId('');
    }
  };

  const askDelete = (e: EventRow) =>
    setDeleting({ id: e.id, name: e.name, campus: e.campus.name, reports: e._count.reports });

  const columns: Column<EventRow>[] = [
    {
      key: 'name',
      header: 'Event',
      width: 'minmax(0,2fr)',
      cell: (e) => (
        <NameCell
          primary={e.name}
          // Tablet hides the Campus column, so the campus sits under the name.
          secondary={allCampuses ? <span className="lg:hidden">{e.campus.name}</span> : undefined}
          href={`/events/details?id=${e.id}`}
        />
      ),
    },
    ...(allCampuses
      ? [
          {
            key: 'campus',
            header: 'Campus',
            width: 'minmax(0,1fr)',
            hideOnTablet: true,
            cell: (e: EventRow) => <TextCell>{e.campus.name}</TextCell>,
          },
        ]
      : []),
    {
      key: 'starts',
      header: 'Starts',
      width: 'minmax(0,1.1fr)',
      cell: (e) =>
        e.started_at ? (
          <NameCell muted primary={formatDate(e.started_at)} secondary={formatTime(e.started_at)} />
        ) : (
          <TextCell>Not set</TextCell>
        ),
    },
    {
      key: 'reports',
      header: 'Reports',
      width: '64px',
      align: 'right',
      cell: (e) => <NumberCell value={e._count.reports} />,
    },
    {
      key: 'status',
      header: 'Status',
      width: '112px',
      cell: (e) => (
        <Chip tone={eventTone(e.status.name)} dot>
          {capitalize(e.status.name)}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '144px',
      // View leaves the row on tablet; the name opens the details.
      tabletWidth: '108px',
      align: 'right',
      cell: (e) => (
        <RowActions>
          <IconAction
            label="View"
            icon={<Eye size={18} aria-hidden />}
            href={`/events/details?id=${e.id}`}
            className="md:hidden lg:inline-flex"
          />
          <IconAction
            label="Export to Excel"
            icon={<Download size={18} aria-hidden />}
            disabled={exportingId === e.id}
            onClick={() => exportExcel(e)}
          />
          <IconAction
            label="Edit"
            icon={<Pencil size={18} aria-hidden />}
            onClick={() => setDrawer({ open: true, eventId: e.id })}
          />
          <IconAction
            label="Delete"
            icon={<Trash2 size={18} aria-hidden />}
            onClick={() => askDelete(e)}
          />
        </RowActions>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Events"
        subtitle={
          campusName
            ? `Drills and incidents at ${campusName}.`
            : 'Drills and incidents across all campuses.'
        }
        actions={
          <Button size="sm" onClick={() => setDrawer({ open: true })}>
            <Plus size={16} aria-hidden />
            Add event
          </Button>
        }
      />

      {error ? (
        <Card className="p-6 text-[15px] text-[#b42318]">
          The events couldn&apos;t be loaded: {error.message}
        </Card>
      ) : (
        <ListCard>
          <ListTabs
            label="Event status"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'ongoing', label: 'Ongoing', count: counts.ongoing },
              { key: 'upcoming', label: 'Upcoming', count: counts.upcoming },
              { key: 'completed', label: 'Completed', count: counts.completed },
            ]}
          />
          <ListToolbar>
            <SearchField
              label="Search events"
              placeholder="Search events…"
              value={query}
              onChange={setQuery}
            />
            <ListCount>{plural(rows.length, 'event', 'events')}</ListCount>
          </ListToolbar>
          <DataTable
            label="Events"
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            loading={isPending}
            empty={
              debounced
                ? `No events match “${debounced}”.`
                : tab === 'all'
                  ? 'No events yet. Add one to start a drill.'
                  : `No ${tab} events.`
            }
            card={(e) => (
              <MobileCard
                title={eventTitle(e.name, e.campus.name)}
                subtitle={
                  e.started_at
                    ? `${formatDate(e.started_at)} · ${formatTime(e.started_at)}`
                    : 'No start time'
                }
                chip={
                  <Chip tone={eventTone(e.status.name)} dot>
                    {capitalize(e.status.name)}
                  </Chip>
                }
                meta={[
                  {
                    label: 'Reports',
                    value: e._count.reports,
                    tone: e._count.reports ? 'default' : 'muted',
                  },
                  ...(e.quarter ? [{ label: 'Quarter', value: e.quarter }] : []),
                ]}
                actions={[
                  {
                    label: 'View',
                    icon: <Eye size={16} aria-hidden />,
                    href: `/events/details?id=${e.id}`,
                  },
                  {
                    label: 'Export',
                    icon: <Download size={16} aria-hidden />,
                    onClick: () => exportExcel(e),
                  },
                  {
                    label: 'Edit',
                    icon: <Pencil size={16} aria-hidden />,
                    onClick: () => setDrawer({ open: true, eventId: e.id }),
                  },
                ]}
              />
            )}
          />
        </ListCard>
      )}

      <EventDrawer
        open={drawer.open}
        // Keeps the event while the drawer slides out.
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        mode={
          drawer.eventId
            ? { kind: 'edit', eventId: drawer.eventId }
            : { kind: 'add', defaultCampusId: campusId || undefined }
        }
      />
      <DeleteEventDialog event={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
