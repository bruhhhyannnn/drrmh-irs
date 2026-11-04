'use client';

import { AccountLoadFailed, ProfileSetup } from '@/components/auth';
import { useOngoingEvents } from '@/components/hooks/use-events';
import { useMyReport } from '@/components/hooks/use-reports';
import { Loader } from '@/components/ui/loader';
import { isNetworkError } from '@/lib/offline-queue';
import { useOfflineQueueStore } from '@/store';
import { useState } from 'react';
import { ErtFrame } from '../_components/frame';
import { useErtAccess, type ErtProfile } from '../_lib/use-ert-access';
import { useFieldQueue } from '../_lib/use-field-queue';
import {
  NoOngoingEvent,
  OfflineFirstLoad,
  ReportLoadFailed,
  SavedOffline,
} from './_components/notice-screens';
import { ErtReportForm } from './_components/report-form';
import { SubmittedReport } from './_components/submitted-report';

/** How often the page checks for a newly started (or ended) event. */
const EVENT_POLL_MS = 30_000;

/**
 * The signed-in ERT member's status report: the form while an event is ongoing, the submitted
 * report after, "saved on this phone" while a report waits offline, and "No ongoing event"
 * between events. One report per member per ongoing event.
 */
export default function ErtReportPage() {
  const access = useErtAccess();

  if (access.status === 'checking') return <PageLoading label="Checking your access…" />;
  if (access.status === 'error') return <AccountLoadFailed />;
  if (access.status === 'setup') return <ProfileSetup />;
  return <ReportScreens profile={access.profile} />;
}

function ReportScreens({ profile }: { profile: ErtProfile }) {
  const isOnline = useOfflineQueueStore((s) => s.isOnline);
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);

  const campusName = profile.campus?.name ?? 'Your campus';

  const myReport = useMyReport(profile.id);
  const events = useOngoingEvents(profile.campus_id ?? '', { refetchInterval: EVENT_POLL_MS });
  const queue = useFieldQueue();

  // With no connection on first load, these queries stay paused with nothing to show.
  const waitingOffline = !isOnline && (myReport.isPending || events.isPending);
  if (!waitingOffline && (myReport.isLoading || events.isLoading)) {
    return <PageLoading label="Loading the ongoing event…" />;
  }

  // A dropped connection on the member's own report still opens the form, which can save
  // offline. A server fault can't save either, and no events must not read as "No ongoing event".
  const loadFailed =
    events.isLoadingError || (myReport.isLoadingError && !isNetworkError(myReport.error));

  const queued = queue.find((e) => e.status === 'pending' && e.payload.user_id === profile.id);
  const ongoing = events.data ?? [];

  let screen: React.ReactNode;
  if (myReport.data) {
    screen = <SubmittedReport reportId={myReport.data.id} campusName={campusName} editable />;
  } else if (queued) {
    screen = <SavedOffline entry={queued} campusName={campusName} />;
  } else if (waitingOffline) {
    screen = <OfflineFirstLoad campusName={campusName} />;
  } else if (loadFailed) {
    screen = (
      <ReportLoadFailed
        campusName={campusName}
        onRetry={() => {
          void myReport.refetch();
          void events.refetch();
        }}
      />
    );
  } else if (ongoing.length === 0) {
    screen = viewingReportId ? (
      <SubmittedReport
        reportId={viewingReportId}
        campusName={campusName}
        editable={false}
        onBack={() => setViewingReportId(null)}
      />
    ) : (
      <NoOngoingEvent
        userId={profile.id}
        campusName={campusName}
        onViewReport={setViewingReportId}
      />
    );
  } else {
    // Keyed by the event list so a newly started event resets the preselection.
    screen = (
      <ErtReportForm
        key={ongoing.map((e) => e.id).join()}
        events={ongoing}
        campusName={campusName}
      />
    );
  }

  return <ErtFrame>{screen}</ErtFrame>;
}

function PageLoading({ label }: { label: string }) {
  return (
    <ErtFrame>
      <Loader label={label} className="flex-1 py-20" />
    </ErtFrame>
  );
}
