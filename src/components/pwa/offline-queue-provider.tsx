'use client';

import { createBystanderReport } from '@/actions/emergency-reports';
import { createReport } from '@/actions/reports';
import {
  getQueuedFieldReportCount,
  getQueuedFieldReports,
  getQueuedReportCount,
  getQueuedReports,
  isNetworkError,
  markQueuedFieldReportFailed,
  markQueuedReportFailed,
  removeQueuedFieldReport,
  removeQueuedReport,
  type QueuedEntry,
} from '@/lib/offline-queue';
import { useOfflineQueueStore } from '@/store';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

// Retries a stalled flush periodically in case the browser's `online` event fired but the
// connection is still flaky (common on mobile data during a disaster/drill scenario).
const RETRY_INTERVAL_MS = 45_000;

interface FlushResult {
  synced: number;
  failed: number;
}

/** Replays every `pending` entry in one queue through `submit`, in order, stopping at the
 * first connectivity failure (leaves the rest queued for the next retry) but continuing past
 * a real server-side rejection (marked `failed` so it stops being retried forever). */
async function flushOne<TPayload>(
  getAll: () => Promise<QueuedEntry<TPayload>[]>,
  remove: (id: string) => Promise<void>,
  markFailed: (id: string, message: string) => Promise<void>,
  submit: (payload: TPayload) => Promise<unknown>
): Promise<FlushResult> {
  const pending = (await getAll()).filter((e) => e.status === 'pending');
  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    try {
      await submit(entry.payload);
      await remove(entry.id);
      synced += 1;
    } catch (err) {
      if (isNetworkError(err)) break;
      await markFailed(entry.id, err instanceof Error ? err.message : 'Submission failed');
      failed += 1;
    }
  }

  return { synced, failed };
}

/**
 * Mounted once at the app root. Tracks connectivity, keeps the pending offline-report count
 * in sync, and flushes the two local queues (see `src/lib/offline-queue.ts`) back to the
 * server the moment the connection returns — bystander reports (public, anonymous) and field
 * reports submitted through `ReportForm` (logged-in ERT members). An entry queued while
 * offline stays queued — never silently dropped — until it either syncs or is confirmed as a
 * real (non-network) failure.
 */
export function OfflineQueueProvider() {
  const { isOnline, setOnline, setPendingCount, setSyncing } = useOfflineQueueStore();
  const flushingRef = useRef(false);
  const queryClient = useQueryClient();

  const refreshCount = async () => {
    try {
      const [bystanderCount, fieldCount] = await Promise.all([
        getQueuedReportCount(),
        getQueuedFieldReportCount(),
      ]);
      setPendingCount(bystanderCount + fieldCount);
    } catch {
      // IndexedDB unavailable (private browsing, unsupported browser) — queue feature is a
      // no-op there, nothing to reflect in the UI
    }
  };

  const flushQueue = async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    setSyncing(true);

    try {
      const [bystanderResult, fieldResult] = await Promise.all([
        flushOne(
          getQueuedReports,
          removeQueuedReport,
          markQueuedReportFailed,
          createBystanderReport
        ),
        flushOne(
          getQueuedFieldReports,
          removeQueuedFieldReport,
          markQueuedFieldReportFailed,
          createReport
        ),
      ]);

      const synced = bystanderResult.synced + fieldResult.synced;
      const failed = bystanderResult.failed + fieldResult.failed;

      if (synced > 0) {
        toast.success(
          synced === 1 ? '1 offline report submitted' : `${synced} offline reports submitted`
        );
        if (bystanderResult.synced > 0) {
          queryClient.invalidateQueries({ queryKey: ['bystander-reports'] });
        }
        if (fieldResult.synced > 0) {
          queryClient.invalidateQueries({ queryKey: ['reports'] });
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

  useEffect(() => {
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
