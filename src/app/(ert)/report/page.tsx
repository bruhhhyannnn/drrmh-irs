'use client';

import { ProfileSetup } from '@/components/auth';
import { useOngoingEvents } from '@/components/hooks/use-events';
import { useMyReport } from '@/components/hooks/use-reports';
import { Loader } from '@/components/ui/loader';
import { isAdminUserType } from '@/lib';
import { useAuthStore, useOfflineQueueStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ErtFrame } from '../_components/frame';
import { useFieldQueue } from '../_lib/use-field-queue';
import { NoOngoingEvent, OfflineFirstLoad, SavedOffline } from './_components/notice-screens';
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
  const router = useRouter();
  const { user, userProfile, loading } = useAuthStore();
  const isOnline = useOfflineQueueStore((s) => s.isOnline);
  const [viewingReportId, setViewingReportId] = useState<string | null>(null);

  const userId = userProfile?.id;
  const campusName = userProfile?.campus?.name ?? 'Your campus';
  const profileReady = !!userProfile?.is_profile_complete;

  const myReport = useMyReport(profileReady ? userId : undefined);
  const events = useOngoingEvents(profileReady ? (userProfile?.campus_id ?? '') : '', {
    refetchInterval: EVENT_POLL_MS,
  });
  const queue = useFieldQueue();

  useEffect(() => {
    if (!loading && !user) router.replace('/signin');
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && userProfile && isAdminUserType(userProfile.user_type?.name)) {
      router.replace('/dashboard');
    }
  }, [loading, userProfile, router]);

  if (loading || !user || !userProfile || isAdminUserType(userProfile.user_type?.name)) {
    return <PageLoading label="Checking your access…" />;
  }

  if (!userProfile.is_profile_complete) return <ProfileSetup />;

  // With no connection on first load, these queries stay paused with nothing to show.
  const waitingOffline = !isOnline && (myReport.isPending || events.isPending);
  if (!waitingOffline && (myReport.isLoading || events.isLoading)) {
    return <PageLoading label="Loading the ongoing event…" />;
  }

  const queued = queue.find((e) => e.status === 'pending' && e.payload.user_id === userProfile.id);
  const ongoing = events.data ?? [];

  let screen: React.ReactNode;
  if (myReport.data) {
    screen = <SubmittedReport reportId={myReport.data.id} campusName={campusName} editable />;
  } else if (queued) {
    screen = <SavedOffline entry={queued} campusName={campusName} />;
  } else if (waitingOffline) {
    screen = <OfflineFirstLoad campusName={campusName} />;
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
        userId={userProfile.id}
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
