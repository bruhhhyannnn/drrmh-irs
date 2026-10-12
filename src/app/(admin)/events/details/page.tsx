'use client';

import { Button } from '@/components/ds';
import {
  useCompleteEvents,
  useEvent,
  useEventSummarySource,
  useSiblingOngoingEvents,
} from '@/components/hooks/use-events';
import { useAuthStore } from '@/store';
import { format } from 'date-fns';
import { Check, Download, Pencil, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../_components/confirm-dialog';
import { PageHeader } from '../../_components/page-header';
import {
  useEventTitle,
  useIsSuperAdmin,
  useScopedCampusId,
} from '../../_components/shell/campus-switcher';
import { EventSummary, useSummary } from '../../_components/summary/event-summary';
import { Card, Chip, Skeleton } from '../../_components/ui';
import { formatEventWindow } from '../../_lib/format';
import { capitalize, eventStatusKey, eventTone } from '../../_lib/status';
import { DeleteEventDialog, type DeletableEvent } from '../_components/delete-event-dialog';
import { EventDrawer } from '../_components/event-drawer';

export default function EventDetailsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <EventDetails />
    </Suspense>
  );
}

/** "Pharmacy has", "Pharmacy and CBEA have", "Pharmacy, CBEA and Library have". */
function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function EventDetails() {
  const router = useRouter();
  const eventId = useSearchParams().get('id') ?? undefined;
  const { data: event, isPending } = useEvent(eventId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState<DeletableEvent | null>(null);
  const [completing, setCompleting] = useState(false);
  const eventTitle = useEventTitle();
  const isSuperAdmin = useIsSuperAdmin();
  const campusId = useScopedCampusId();

  if (isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-20 w-full max-w-140" />
        <Skeleton className="h-80" />
      </div>
    );
  }
  // Administrators only see events at their own campus.
  if (!event || !eventId || (!isSuperAdmin && event.campus_id !== campusId)) {
    return (
      <>
        <PageHeader title="Event not found" back={{ href: '/events', label: 'Events' }} />
        <Card className="p-8 text-[17px] text-gray-600">
          This event doesn&apos;t exist anymore. It may have been deleted.
        </Card>
      </>
    );
  }

  const status = eventStatusKey(event.status.name);
  const title = eventTitle(event.name, event.campus.name);
  const exportPdf = () => window.open(`/events/report?id=${event.id}`, '_blank', 'noopener');

  return (
    <>
      <PageHeader
        back={{ href: '/events', label: 'Events' }}
        title={title}
        chip={
          <Chip tone={eventTone(event.status.name)} dot>
            {capitalize(event.status.name)}
          </Chip>
        }
        subtitle={[formatEventWindow(event.started_at, event.ended_at), event.quarter]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            {status === 'ongoing' && (
              <Button size="sm" onClick={() => setCompleting(true)}>
                <Check size={16} aria-hidden />
                Complete event
              </Button>
            )}
            <Button
              size="sm"
              variant={status === 'completed' ? 'primary' : 'outline'}
              onClick={exportPdf}
            >
              <Download size={16} aria-hidden />
              Export PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil size={16} aria-hidden />
              Edit
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                setDeleting({
                  id: event.id,
                  name: event.name,
                  campus: event.campus.name,
                  reports: event._count.reports,
                })
              }
            >
              <Trash2 size={16} aria-hidden />
              Delete
            </Button>
          </>
        }
      />

      <EventSummary key={event.id} eventId={event.id} />

      <EventDrawer
        open={editing}
        onClose={() => setEditing(false)}
        mode={{ kind: 'edit', eventId: event.id }}
      />
      <DeleteEventDialog
        event={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => router.push('/events')}
      />
      <CompleteEventDialog
        open={completing}
        onClose={() => setCompleting(false)}
        eventId={event.id}
        title={title}
        eventName={event.name}
      />
    </>
  );
}

/**
 * Complete event: status Completed and end time now, in one step. Names clusters with no report
 * so nobody completes too early. Super admins can complete the same event at other campuses too;
 * administrators only see their own.
 */
function CompleteEventDialog({
  open,
  onClose,
  eventId,
  title,
  eventName,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  title: string;
  eventName: string;
}) {
  const userId = useAuthStore((s) => s.userProfile?.id ?? null);
  const { data: source } = useEventSummarySource(eventId);
  const summary = useSummary(source);
  const isSuperAdmin = useIsSuperAdmin();
  const { data: siblings = [] } = useSiblingOngoingEvents(eventId, {
    enabled: open && isSuperAdmin,
  });
  const completeEvents = useCompleteEvents();
  const [alsoOthers, setAlsoOthers] = useState(false);

  const pending = summary?.clusters.pending.map((c) => c.name) ?? [];
  const locked =
    'Once the event is completed, ERT members can no longer send or edit reports for it.';
  const ids = [eventId, ...(isSuperAdmin && alsoOthers ? siblings.map((s) => s.id) : [])];
  const otherCampuses = listNames(siblings.map((s) => s.campus.name));

  const confirm = () =>
    completeEvents.mutate(
      { ids, userId },
      {
        onSuccess: () => {
          toast.success(ids.length > 1 ? `${ids.length} events completed` : 'Event completed');
          setAlsoOthers(false);
          onClose();
        },
        onError: (err) => toast.error(err.message),
      }
    );

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={confirm}
      loading={completeEvents.isPending}
      tone="success"
      icon={<Check size={20} aria-hidden />}
      title="Complete this event?"
      name={title}
      body={`will be marked Completed, with ${format(new Date(), 'h:mm a')} as its end time.`}
      warning={
        pending.length
          ? `${listNames(pending)} ${pending.length === 1 ? 'has' : 'have'} not reported yet. ${locked}`
          : locked
      }
      checkbox={
        isSuperAdmin && siblings.length
          ? {
              label: `Also complete it at ${otherCampuses}`,
              description:
                siblings.length === 1
                  ? `It is also a ${eventName} event that is still ongoing.`
                  : `${siblings.length === 2 ? 'Both' : `All ${siblings.length}`} are ${eventName} events that are still ongoing.`,
              checked: alsoOthers,
              onChange: setAlsoOthers,
            }
          : undefined
      }
      confirmVariant="primary"
      confirmLabel={ids.length > 1 ? `Complete ${ids.length} events` : 'Complete event'}
    />
  );
}
