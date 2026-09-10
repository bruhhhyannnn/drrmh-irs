'use client';

import { PageBreadcrumb } from '@/components/common';
import { useEvent } from '@/components/hooks/use-events';
import { Badge, Spinner } from '@/components/ui';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { EventSummary } from './event-summary';

export default function EventDetailsPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <EventDetailsContent />
    </Suspense>
  );
}

// ─── Main content ─────────────────────────────────────────
function EventDetailsContent() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('id') ?? undefined;

  const { data: event, isPending: loadingEvent } = useEvent(eventId);

  if (loadingEvent)
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );

  if (!event) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-gray-400">Event not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageBreadcrumb pageTitle="Event Details" />
      <div className="shadow-theme-sm rounded-xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/3">
        <div className="mt-2 flex flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{event.name}</h1>
          <div>
            {event.status.name && (
              <Badge
                color={
                  event.status.name === 'ongoing'
                    ? 'success'
                    : event.status.name === 'completed'
                      ? 'primary'
                      : 'warning'
                }
                size="sm"
              >
                {event.status.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Meta info row */}
        <div className="mt-5 flex flex-wrap gap-4 text-sm text-gray-500">
          {event.started_at && (
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              {format(new Date(event.started_at), 'MMM d, yyyy')}
            </div>
          )}
          {event.started_at && (
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              {format(new Date(event.started_at), 'h:mm a')}
              {event.ended_at && ` — ${format(new Date(event.ended_at), 'h:mm a')}`}
            </div>
          )}
        </div>
      </div>
      <EventSummary eventId={eventId} campusId={event?.campus_id} />{' '}
    </div>
  );
}
