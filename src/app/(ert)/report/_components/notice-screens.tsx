'use client';

import { Button } from '@/components/ds';
import { useMyLatestReport } from '@/components/hooks/use-reports';
import type { QueuedFieldReport } from '@/lib/offline-queue';
import { useOfflineQueueStore } from '@/store';
import { Calendar, WifiOff } from 'lucide-react';
import { DetailList, Dot, Hero, Mono, NoticeCard, Pill } from '../../_components/chrome';
import { formatDateTime } from '../../_lib/format';
import { queuedHeadcount } from '../../_lib/use-field-queue';

/**
 * Shown when the campus has no ongoing event, instead of an empty event picker. The page
 * checks for new events on its own; the member's last report stays one tap away.
 */
export function NoOngoingEvent({
  userId,
  campusName,
  onViewReport,
}: {
  userId: string;
  campusName: string;
  onViewReport: (reportId: string) => void;
}) {
  const { data: lastReport } = useMyLatestReport(userId);
  return (
    <>
      <Hero eyebrow={campusName} title="Status report" />
      <NoticeCard
        icon={<Calendar size={30} aria-hidden />}
        iconTone="neutral"
        title="No ongoing event"
        description="The report form opens here when the DRRM-H office starts an event. This page updates on its own."
      >
        {lastReport && (
          <>
            <DetailList
              title="Your last report"
              rows={[
                { label: 'Event', value: lastReport.eventName },
                {
                  label: 'Submitted',
                  value: (
                    <Mono className="text-[14px] font-normal">
                      {formatDateTime(lastReport.submittedAt)}
                    </Mono>
                  ),
                },
                { label: 'Headcount', value: <Mono>{lastReport.headcount}</Mono> },
              ]}
            />
            <Button variant="outline" fullWidth onClick={() => onViewReport(lastReport.id)}>
              View last report
            </Button>
          </>
        )}
      </NoticeCard>
    </>
  );
}

/**
 * After a report is saved offline. Stays until it sends — the page then shows the submitted
 * report — even if the app is closed and opened again.
 */
export function SavedOffline({
  entry,
  campusName,
}: {
  entry: QueuedFieldReport;
  campusName: string;
}) {
  const isOnline = useOfflineQueueStore((s) => s.isOnline);
  const isSyncing = useOfflineQueueStore((s) => s.isSyncing);
  const eventName = entry.summary?.title ?? 'Status report';

  return (
    <>
      <Hero eyebrow={`Status report · ${campusName}`} title={eventName}>
        <Pill tone="warning" icon={<WifiOff size={12} aria-hidden />}>
          {isOnline ? 'Waiting to send' : 'Offline'}
        </Pill>
      </Hero>
      <NoticeCard
        icon={<WifiOff size={30} aria-hidden />}
        iconTone="warning"
        title="Report saved on this phone"
        description="It will be submitted automatically when your connection returns."
      >
        <DetailList
          rows={[
            { label: 'Event', value: eventName },
            { label: 'Headcount', value: <Mono>{queuedHeadcount(entry)}</Mono> },
            {
              label: 'Saved',
              value: (
                <Mono className="text-[14px] font-normal">{formatDateTime(entry.createdAt)}</Mono>
              ),
            },
            {
              label: 'Status',
              value: (
                <span className="flex justify-end">
                  <Pill tone="warning" icon={<Dot className="bg-warning-500" />}>
                    {!isOnline
                      ? 'Waiting for connection'
                      : isSyncing
                        ? 'Sending…'
                        : 'Waiting to retry'}
                  </Pill>
                </span>
              ),
            },
          ]}
        />
        <p className="text-[14px] leading-normal text-gray-500">
          Tries again every 45 s and as soon as signal returns. Keep the app installed until it
          sends.
        </p>
      </NoticeCard>
    </>
  );
}

/** First load with no connection: the lookups the form needs haven't been fetched yet. */
export function OfflineFirstLoad({ campusName }: { campusName: string }) {
  return (
    <>
      <Hero eyebrow={campusName} title="Status report" />
      <NoticeCard
        icon={<WifiOff size={30} aria-hidden />}
        iconTone="warning"
        title="You’re offline"
        description="The report form needs a connection the first time it opens. It loads here as soon as you’re back online."
      />
    </>
  );
}
