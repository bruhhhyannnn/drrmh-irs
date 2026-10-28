'use client';

import { Button, Select } from '@/components/ds';
import { useCampusOverview, useDeleteCampus } from '@/components/hooks/use-campus';
import { useCampusEventOptions } from '@/components/hooks/use-events';
import { Pencil, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../_components/confirm-dialog';
import { PageHeader } from '../../_components/page-header';
import { EventSummary } from '../../_components/summary/event-summary';
import { CampusMark, Card, Chip, Skeleton } from '../../_components/ui';
import { formatEventWindow, plural } from '../../_lib/format';
import { capitalize, eventStatusKey, eventTone } from '../../_lib/status';
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
  const campusId = useSearchParams().get('id') ?? undefined;
  const { data: campus, isPending } = useCampusOverview(campusId);
  const { data: events = [], isPending: eventsPending } = useCampusEventOptions(campusId);
  const deleteCampus = useDeleteCampus();
  const [pickedId, setPickedId] = useState('');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  const selected = events.find((e) => e.id === pickedId) ?? defaultEvent(events);

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

  return (
    <>
      <PageHeader
        back={{ href: '/campus', label: 'Campus' }}
        logo={<CampusMark name={campus.name} />}
        title={campus.name}
        chip={
          <Chip tone={campus.is_active ? 'green' : 'grey'} dot>
            {campus.is_active ? 'Active' : 'Inactive'}
          </Chip>
        }
        subtitle={`${plural(eventCount, 'event', 'events')} · ${plural(users, 'user', 'users')} · ${plural(fields, 'population field', 'population fields')}`}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil size={16} aria-hidden />
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={() => setDeleting(true)}>
              <Trash2 size={16} aria-hidden />
              Delete
            </Button>
          </>
        }
      />

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
          before={
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-[18px] border border-gray-200 bg-surface px-4 py-3 md:px-5">
              <label htmlFor="campus-event" className="text-[16px] font-semibold text-gray-600">
                Showing
              </label>
              <div className="max-w-110 min-w-0 flex-[1_1_240px]">
                <Select
                  id="campus-event"
                  variant="filter"
                  value={selected.id}
                  onChange={setPickedId}
                  options={events.map((e) => ({
                    value: e.id,
                    label: `${e.name} · ${capitalize(e.status.name)}`,
                  }))}
                  className="font-semibold text-gray-900"
                />
              </div>
              <Chip tone={eventTone(selected.status.name)} dot>
                {capitalize(selected.status.name)}
              </Chip>
              <span className="text-[14px] leading-[1.4] text-gray-500">
                {formatEventWindow(selected.started_at, selected.ended_at)} ·{' '}
                {plural(events.length, 'event', 'events')} at this campus
              </span>
            </div>
          }
        />
      )}

      <CampusDrawer open={editing} onClose={() => setEditing(false)} campus={campus} />
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
