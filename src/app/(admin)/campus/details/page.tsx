'use client';

import { Button, FOCUS_RING, Select } from '@/components/ds';
import { useCampusOverview, useDeleteCampus } from '@/components/hooks/use-campus';
import { useCampusEventOptions } from '@/components/hooks/use-events';
import { cn } from '@/lib';
import { useCampusScopeStore } from '@/store';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Download,
  ListChecks,
  Network,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import toast from 'react-hot-toast';
import { CampusBackdrop } from '../../_components/campus-backdrop';
import { ConfirmDialog } from '../../_components/confirm-dialog';
import { PageHeader } from '../../_components/page-header';
import { CompletedChip } from '../../_components/summary/completed-note';
import { EventSummary } from '../../_components/summary/event-summary';
import { CampusMark, Card, Chip, Mono, Skeleton } from '../../_components/ui';
import { formatEventWindow, plural } from '../../_lib/format';
import { nsedTemplateFor } from '../../_lib/nsed-report';
import { capitalize, eventStatusKey, eventTone } from '../../_lib/status';
import { CompleteEventDialog } from '../../events/_components/complete-event-dialog';
import { ExportNsedButton } from '../../events/_components/export-nsed';
import { CampusDrawer } from '../_components/campus-drawer';

export default function CampusDetailsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <CampusDetails />
    </Suspense>
  );
}

type EventOption = NonNullable<ReturnType<typeof useCampusEventOptions>['data']>[number];

/** Ongoing first, then the latest event that has started, then the newest one. */
function defaultEvent(events: EventOption[]) {
  const now = Date.now();
  return (
    events.find((e) => eventStatusKey(e.status.name) === 'ongoing') ??
    events.find((e) => e.started_at && new Date(e.started_at).getTime() <= now) ??
    events[0]
  );
}

function CampusDetails() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const campusId = searchParams.get('id') ?? undefined;
  const { data: campus, isPending } = useCampusOverview(campusId);
  const { data: events = [], isPending: eventsPending } = useCampusEventOptions(campusId);
  const deleteCampus = useDeleteCampus();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const setScope = useCampusScopeStore((s) => s.setCampusId);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-20 w-full max-w-120" />
        <Skeleton className="h-16" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (!campus) {
    return (
      <>
        <PageHeader title="Campus not found" back={{ href: '/campus', label: 'Campus' }} />
        <Card className="p-8 text-[17px] text-gray-600">
          This campus doesn&apos;t exist anymore. It may have been deleted.
        </Card>
      </>
    );
  }

  const { events: eventCount, users, clusters, population_categories: fields } = campus._count;
  const selected = events.find((e) => e.id === searchParams.get('event')) ?? defaultEvent(events);

  // The picked event lives in the link, so a shared cluster or unit link opens the same event.
  // Replacing the entry keeps Back from stepping through every event looked at.
  const pickEvent = (eventId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('event', eventId);
    next.delete('cluster');
    next.delete('unit');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const remove = () =>
    deleteCampus.mutate(campus.id, {
      onSuccess: () => {
        toast.success(`${campus.name} deleted`);
        router.push('/campus');
      },
      onError: (err) => {
        setDeleting(false);
        toast.error(err.message);
      },
    });

  const blocking = eventCount + users;
  const selectedStatus = selected ? eventStatusKey(selected.status.name) : null;

  // Each count opens its list scoped to this campus, through the top-bar campus switcher.
  const counts = [
    { label: 'Events', value: eventCount, href: '/events', icon: CalendarDays },
    { label: 'Users', value: users, href: '/users', icon: Users },
    { label: 'Clusters', value: clusters, href: '/settings/clusters', icon: Network },
    { label: 'Units', value: campus.units, href: '/settings/units', icon: Building2 },
    {
      label: 'Population fields',
      value: fields,
      href: `/settings/population-fields?campus=${campus.id}`,
      icon: ListChecks,
    },
  ];

  return (
    <>
      <CampusBackdrop name={campus.name} />
      <PageHeader
        back={{ href: '/campus', label: 'Campus' }}
        logo={<CampusMark name={campus.name} className="size-16 md:size-24" />}
        title={campus.name}
        chip={
          <Chip tone={campus.is_active ? 'green' : 'grey'} dot>
            {campus.is_active ? 'Active' : 'Inactive'}
          </Chip>
        }
        subtitle={plural(clusters, 'cluster', 'clusters')}
        menu={[
          { label: 'Edit campus', icon: Pencil, onSelect: () => setEditing(true) },
          {
            label: 'Population fields',
            icon: Users,
            href: `/settings/population-fields?campus=${campus.id}`,
          },
          { label: 'Delete campus', icon: Trash2, danger: true, onSelect: () => setDeleting(true) },
        ]}
      />

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {counts.map((c) => (
          <li key={c.label}>
            <Link
              href={c.href}
              onClick={() => setScope(campus.id)}
              className={cn(
                'flex h-full items-center gap-3 rounded-[16px] border border-gray-200 bg-surface px-4 py-3 text-gray-900 transition-[border-color,box-shadow] duration-120 ease-out hover:border-gray-300 hover:shadow-[0_10px_24px_rgba(16,24,40,.12)]',
                FOCUS_RING
              )}
            >
              <c.icon size={20} aria-hidden className="shrink-0 text-gray-500" />
              <span className="flex min-w-0 flex-col">
                <Mono className="text-[19px] leading-tight font-bold">{c.value}</Mono>
                <span className="truncate text-[13px] text-gray-600">{c.label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {eventsPending ? (
        <Skeleton className="h-80" />
      ) : !selected ? (
        <Card className="p-8 text-center text-[17px] text-gray-600">
          No events at this campus yet. Add one from Events to see its reports here.
        </Card>
      ) : (
        <EventSummary
          key={selected.id}
          eventId={selected.id}
          linkParams={{ event: selected.id }}
          before={
            <div className="flex flex-col gap-3 rounded-[18px] border border-gray-200 bg-surface px-4 py-3 md:px-5">
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
                <label htmlFor="campus-event" className="text-[16px] font-semibold text-gray-600">
                  Showing
                </label>
                <div className="max-w-110 min-w-0 flex-[1_1_240px]">
                  <Select
                    id="campus-event"
                    variant="filter"
                    value={selected.id}
                    onChange={pickEvent}
                    options={events.map((e) => ({
                      value: e.id,
                      label: `${e.name} · ${capitalize(e.status.name)}`,
                    }))}
                    className="font-semibold text-gray-900"
                  />
                </div>
                {eventStatusKey(selected.status.name) === 'completed' ? (
                  <CompletedChip eventId={selected.id} />
                ) : (
                  <Chip tone={eventTone(selected.status.name)} dot>
                    {capitalize(selected.status.name)}
                  </Chip>
                )}
                <span className="text-[14px] leading-[1.4] text-gray-500">
                  {formatEventWindow(selected.started_at, selected.ended_at)} ·{' '}
                  {plural(events.length, 'event', 'events')} at this campus
                </span>
              </div>
              {/* The picked event's own actions, as on its page. */}
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {selectedStatus === 'ongoing' && (
                  <Button size="sm" onClick={() => setCompleting(true)}>
                    <Check size={16} aria-hidden />
                    Complete event
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={selectedStatus === 'ongoing' ? 'outline' : 'primary'}
                  onClick={() =>
                    window.open(`/events/report?id=${selected.id}`, '_blank', 'noopener')
                  }
                >
                  <Download size={16} aria-hidden />
                  Export PDF
                </Button>
                {selectedStatus === 'completed' && nsedTemplateFor(campus.name) && (
                  <ExportNsedButton eventId={selected.id} />
                )}
                <Link
                  href={`/events/details?id=${selected.id}`}
                  className={cn(
                    'ml-auto inline-flex h-10 items-center gap-2 rounded-full px-3 text-[15px] font-bold text-gray-900 transition-colors duration-120 ease-out hover:bg-hover',
                    FOCUS_RING
                  )}
                >
                  <ArrowRight size={16} aria-hidden />
                  Open event details
                </Link>
              </div>
            </div>
          }
        />
      )}

      <CampusDrawer open={editing} onClose={() => setEditing(false)} campus={campus} />
      {selected && (
        <CompleteEventDialog
          open={completing}
          onClose={() => setCompleting(false)}
          eventId={selected.id}
          title={`${selected.name} — ${campus.name}`}
          eventName={selected.name}
        />
      )}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={remove}
        loading={deleteCampus.isPending}
        tone="danger"
        icon={<Trash2 size={20} aria-hidden />}
        title="Delete this campus?"
        name={campus.name}
        body="will be permanently deleted. This cannot be undone."
        warning={
          blocking > 0
            ? `${plural(eventCount, 'event', 'events')} and ${plural(users, 'user', 'users')} are linked to this campus. Move or delete them first; a campus with events or users can't be deleted.`
            : clusters > 0
              ? `Its ${plural(clusters, 'cluster', 'clusters')} and their units will be deleted with it.`
              : undefined
        }
        confirmLabel="Delete campus"
      />
    </>
  );
}
