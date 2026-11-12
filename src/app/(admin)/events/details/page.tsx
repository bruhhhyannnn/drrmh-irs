'use client';

import { Button } from '@/components/ds';
import { useEvent } from '@/components/hooks/use-events';
import { Check, Download, Pencil, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CampusBackdrop } from '../../_components/campus-backdrop';
import { PageHeader } from '../../_components/page-header';
import {
  useEventTitle,
  useIsSuperAdmin,
  useScopedCampusId,
} from '../../_components/shell/campus-switcher';
import { CompletedChip } from '../../_components/summary/completed-note';
import { EventSummary } from '../../_components/summary/event-summary';
import { CampusMark, Card, Chip, Skeleton } from '../../_components/ui';
import { formatEventWindow } from '../../_lib/format';
import { nsedTemplateFor } from '../../_lib/nsed-report';
import { capitalize, eventStatusKey, eventTone } from '../../_lib/status';
import { CompleteEventDialog } from '../_components/complete-event-dialog';
import { DeleteEventDialog, type DeletableEvent } from '../_components/delete-event-dialog';
import { EventDrawer } from '../_components/event-drawer';
import { ExportNsedButton } from '../_components/export-nsed';

export default function EventDetailsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <EventDetails />
    </Suspense>
  );
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
      <CampusBackdrop name={event.campus.name} />
      <PageHeader
        back={{ href: '/events', label: 'Events' }}
        logo={<CampusMark name={event.campus.name} className="size-12 md:size-16" />}
        title={title}
        chip={
          // A completed event's note minimizes into its chip.
          status === 'completed' ? (
            <CompletedChip eventId={event.id} />
          ) : (
            <Chip tone={eventTone(event.status.name)} dot>
              {capitalize(event.status.name)}
            </Chip>
          )
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
              variant={status === 'ongoing' ? 'outline' : 'primary'}
              onClick={exportPdf}
            >
              <Download size={16} aria-hidden />
              Export PDF
            </Button>
            {status === 'completed' && nsedTemplateFor(event.campus.name) && (
              <ExportNsedButton eventId={event.id} />
            )}
          </>
        }
        menu={[
          { label: 'Edit event', icon: Pencil, onSelect: () => setEditing(true) },
          {
            label: 'Delete event',
            icon: Trash2,
            danger: true,
            onSelect: () =>
              setDeleting({
                id: event.id,
                name: event.name,
                campus: event.campus.name,
                reports: event._count.reports,
              }),
          },
        ]}
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
