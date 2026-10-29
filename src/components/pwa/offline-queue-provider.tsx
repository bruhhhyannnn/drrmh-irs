'use client';

import { createAssessment } from '@/actions/assessments';
import { createBystanderReport } from '@/actions/emergency-reports';
import { createReport } from '@/actions/reports';
import { toBystanderPhotoFormData, toReportPhotoFormData } from '@/lib';
import { withTimeout } from '@/lib/offline-cache';
import { flushOne } from '@/lib/offline-flush';
import {
  getAllQueuedCount,
  getQueuedAssessments,
  getQueuedFieldReports,
  getQueuedReports,
  markQueuedAssessmentFailed,
  markQueuedFieldReportFailed,
  markQueuedReportFailed,
  removeQueuedAssessment,
  removeQueuedFieldReport,
  removeQueuedReport,
} from '@/lib/offline-queue';
import type { AssessmentPayload } from '@/lib/schemas';
import { getAccessToken } from '@/lib/supabase';
import { useAuthStore, useOfflineQueueStore, useRateAppStore } from '@/store';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

// Retries a stalled flush periodically in case the browser's `online` event fired but the
// connection is still flaky (common on mobile data during a disaster/drill scenario).
const RETRY_INTERVAL_MS = 45_000;

/** How long one queued assessment may take before it counts as a dropped connection. */
const ASSESSMENT_SEND_TIMEOUT_MS = 30_000;

/** createAssessment answers instead of throwing. A `retry` answer (signed out, another account
 * on this phone) is thrown as a TypeError so flushOne keeps the entry pending, like a dropped
 * connection; any other refusal marks it failed. */
async function submitQueuedAssessment(payload: AssessmentPayload) {
  const result = await withTimeout(
    createAssessment(await getAccessToken(), payload),
    ASSESSMENT_SEND_TIMEOUT_MS
  );
  if (result.ok) return;
  if (result.retry) throw new TypeError(result.error);
  throw new Error(result.error);
}

/**
 * Mounted once at the app root. Tracks connectivity, keeps the pending offline-report count
 * in sync, and flushes the three local queues (see `src/lib/offline-queue.ts`) back to the
 * server the moment the connection returns — bystander reports (public, anonymous), field
 * reports submitted through `ReportForm` (logged-in ERT members) and building assessments,
 * sent with the signed-in user's access token. An entry queued while
 * offline stays queued — never silently dropped — until it either syncs or is confirmed as a
 * real (non-network) failure.
 */
export function OfflineQueueProvider() {
  const { isOnline, setOnline, setPendingCount, setSyncing } = useOfflineQueueStore();
  const flushingRef = useRef(false);
  const queryClient = useQueryClient();

  const refreshCount = async () => {
    try {
      setPendingCount(await getAllQueuedCount());
    } catch {
      // IndexedDB unavailable (private browsing, unsupported browser) — queue feature is a
      // no-op there, nothing to reflect in the UI
    }
  };

  const flushQueue = async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    setSyncing(true);
    useOfflineQueueStore.setState({ lastAttemptAt: Date.now() });

    try {
      const [bystanderResult, fieldResult, assessmentResult] = await Promise.all([
        flushOne(getQueuedReports, removeQueuedReport, markQueuedReportFailed, (payload, photos) =>
          createBystanderReport(payload, toBystanderPhotoFormData(photos))
        ),
        flushOne(
          getQueuedFieldReports,
          removeQueuedFieldReport,
          markQueuedFieldReportFailed,
          // The report's time is when it was sent on the phone, not when it got through.
          (payload, photos, entry) =>
            createReport({ ...payload, sent_at: entry.createdAt }, toReportPhotoFormData(photos))
        ),
        // Only the signed-in account's own: on a shared phone another member's entry waits
        // for them instead of blocking (or being refused for) whoever is signed in now.
        flushOne(
          getQueuedAssessments,
          removeQueuedAssessment,
          markQueuedAssessmentFailed,
          submitQueuedAssessment,
          (entry) => entry.payload.evaluator_id === useAuthStore.getState().userProfile?.id
        ),
      ]);

      if (assessmentResult.synced > 0) {
        const n = assessmentResult.synced;
        toast.success(
          n === 1 ? '1 offline assessment submitted' : `${n} offline assessments submitted`
        );
        queryClient.invalidateQueries({ queryKey: ['my-assessments'] });
        // A building added offline only exists once its assessment lands.
        queryClient.invalidateQueries({ queryKey: ['assessment-setup'] });
      }
      if (assessmentResult.failed > 0) {
        const n = assessmentResult.failed;
        toast.error(
          n === 1
            ? '1 offline assessment could not be submitted — check waiting to send'
            : `${n} offline assessments could not be submitted — check waiting to send`
        );
      }

      const synced = bystanderResult.synced + fieldResult.synced;
      const failed = bystanderResult.failed + fieldResult.failed;

      if (synced > 0) {
        toast.success(
          synced === 1 ? '1 offline report submitted' : `${synced} offline reports submitted`
        );
        // A report saved offline asks to rate the app once it goes through.
        useRateAppStore.getState().reportSent();
        if (bystanderResult.synced > 0) {
          queryClient.invalidateQueries({ queryKey: ['bystander-reports'] });
        }
        if (fieldResult.synced > 0) {
          useOfflineQueueStore.setState({ lastFieldSyncAt: Date.now() });
          queryClient.invalidateQueries({ queryKey: ['reports'] });
          queryClient.invalidateQueries({ queryKey: ['my-report'] });
          queryClient.invalidateQueries({ queryKey: ['my-latest-report'] });
        }
      }
      if (failed > 0) {
        toast.error(
          failed === 1
            ? '1 offline report failed to submit — check pending reports'
            : `${failed} offline reports failed to submit — check pending reports`
        );
      }
    } finally {
      flushingRef.current = false;
      setSyncing(false);
      refreshCount();
    }
  };

  // Lets a "Try sending now" button skip the wait for the next retry.
  const flushRef = useRef(flushQueue);
  flushRef.current = flushQueue;

  useEffect(() => {
    useOfflineQueueStore.setState({ flushNow: () => void flushRef.current() });
    setOnline(navigator.onLine);
    refreshCount();

    const handleOnline = () => {
      setOnline(true);
      flushQueue();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Covers the case where the app is reopened already online with reports still queued
    // from a previous offline session.
    if (navigator.onLine) flushQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
    // Intentionally run once on mount — flushQueue/refreshCount are stable enough for this
    // provider's lifetime and re-binding them here would just re-attach identical listeners.
  }, []);

  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(flushQueue, RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isOnline]);

  return null;
}
