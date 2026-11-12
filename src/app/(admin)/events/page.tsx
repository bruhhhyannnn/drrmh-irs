'use client';

import { Button } from '@/components/ds';
import { useCampuses } from '@/components/hooks/use-campus';
import { useDebounced } from '@/components/hooks/use-debounced';
import { useEvents } from '@/components/hooks/use-events';
import { Download, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
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
import { CampusMark, Card, Chip } from '../_components/ui';
import { formatDate, formatTime, plural } from '../_lib/format';
import { nsedTemplateFor } from '../_lib/nsed-report';
import { capitalize, eventStatusKey, eventTone, type EventStatus } from '../_lib/status';
import { DeleteEventDialog, type DeletableEvent } from './_components/delete-event-dialog';
import { EventDrawer } from './_components/event-drawer';
import { useExportNsed } from './_components/export-nsed';

type EventRow = NonNullable<ReturnType<typeof useEvents>['data']>[number];
type Tab = 'all' | EventStatus;

const detailsHref = (id: string) => `/events/details?id=${id}`;

/** A completed event at a campus with an NSED report template exports it from its row. */
const hasNsed = (e: EventRow) =>
  eventStatusKey(e.status.name) === 'completed' && !!nsedTemplateFor(e.campus.name);

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
  const { exportNsed, exporting } = useExportNsed();

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

  // The same report as Export PDF on event details: it opens the print dialog to save as PDF.
  const exportPdf = (event: EventRow) =>
    window.open(`/events/report?id=${event.id}`, '_blank', 'noopener');

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
          href={detailsHref(e.id)}
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
            cell: (e: EventRow) => (
              <span className="flex min-w-0 items-center gap-2.5">
                <CampusMark name={e.campus.name} size={28} />
                <TextCell>{e.campus.name}</TextCell>
              </span>
            ),
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
      align: 'right',
      cell: (e) => (
        <RowActions>
          {hasNsed(e) ? (
            <IconAction
              label="Export NSED report"
              icon={<FileText size={18} aria-hidden />}
              onClick={() => exportNsed(e.id)}
              disabled={exporting === e.id}
            />
          ) : (
            // An empty slot keeps the icons lined up down the column.
            <span aria-hidden className="size-9 shrink-0" />
          )}
          <IconAction
            label="Export PDF"
            icon={<Download size={18} aria-hidden />}
            onClick={() => exportPdf(e)}
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
        <Card className="p-6 text-[17px] text-error-700">
          The events couldn&apos;t be loaded: {error.message}
        </Card>
      ) : (
        <ListCard>
          <ListTabs
            loading={isPending}
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
            <ListCount loading={isPending}>{plural(rows.length, 'event', 'events')}</ListCount>
          </ListToolbar>
          <DataTable
            label="Events"
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            // The whole row opens the event; the name is its link.
            rowHref={(e) => detailsHref(e.id)}
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
                avatar={<CampusMark name={e.campus.name} size={44} />}
                title={e.name}
                subtitle={[
                  e.campus.name,
                  e.started_at
                    ? `${formatDate(e.started_at)} · ${formatTime(e.started_at)}`
                    : 'No start time',
                ].join(' · ')}
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
                href={detailsHref(e.id)}
                actions={[
                  {
                    label: 'Export PDF',
                    icon: <Download size={16} aria-hidden />,
                    onClick: () => exportPdf(e),
                  },
                  ...(hasNsed(e)
                    ? [
                        {
                          label: 'NSED',
                          icon: <FileText size={16} aria-hidden />,
                          onClick: () => exportNsed(e.id),
                          disabled: exporting === e.id,
                        },
                      ]
                    : []),
                ]}
                menu={{
                  title: eventTitle(e.name, e.campus.name),
                  items: [
                    {
                      label: 'Edit event',
                      icon: Pencil,
                      onSelect: () => setDrawer({ open: true, eventId: e.id }),
                    },
                    {
                      label: 'Delete event',
                      icon: Trash2,
                      danger: true,
                      onSelect: () => askDelete(e),
                    },
                  ],
                }}
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
