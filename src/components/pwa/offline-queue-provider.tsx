'use client';

import { createBystanderReport } from '@/actions/emergency-reports';
import {
  getQueuedReportCount,
  getQueuedReports,
  isNetworkError,
  markQueuedReportFailed,
  removeQueuedReport,
} from '@/lib/offline-queue';
import { useOfflineQueueStore } from '@/store';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

// Retries a stalled flush periodically in case the browser's `online` event fired but the
// connection is still flaky (common on mobile data during a disaster/drill scenario).
const RETRY_INTERVAL_MS = 45_000;

/**
 * Mounted once at the app root. Tracks connectivity, keeps the pending offline-report count
 * in sync, and flushes the local queue (see `src/lib/offline-queue.ts`) back to the server
 * the moment the connection returns. A report queued while offline stays queued — never
 * silently dropped — until it either syncs or is confirmed as a real (non-network) failure.
 */
export function OfflineQueueProvider() {
  const { isOnline, setOnline, setPendingCount, setSyncing } = useOfflineQueueStore();
  const flushingRef = useRef(false);
  const queryClient = useQueryClient();

  const refreshCount = async () => {
    try {
      setPendingCount(await getQueuedReportCount());
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
      const queued = await getQueuedReports();
      const pending = queued.filter((r) => r.status === 'pending');
      if (pending.length === 0) return;

      let synced = 0;
      let failed = 0;

      for (const report of pending) {
        try {
          await createBystanderReport(report.payload);
          await removeQueuedReport(report.id);
          synced += 1;
        } catch (err) {
          if (isNetworkError(err)) {
            // Still offline in practice — stop here and let the next online/retry trigger it
            break;
          }
          await markQueuedReportFailed(
            report.id,
            err instanceof Error ? err.message : 'Submission failed'
          );
          failed += 1;
        }
      }

      if (synced > 0) {
        toast.success(
          synced === 1 ? '1 offline report submitted' : `${synced} offline reports submitted`
        );
        queryClient.invalidateQueries({ queryKey: ['bystander-reports'] });
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
