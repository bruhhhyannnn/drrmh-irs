'use client';

import { createBystanderReport } from '@/actions/emergency-reports';
import { createReport } from '@/actions/reports';
import { AUTH_SESSION_CHANGED_EVENT } from '@/lib/auth-cookie';
import {
  getOfflineReportQueue,
  markOfflineReportAttempt,
  removeOfflineReport,
  subscribeToOfflineReportQueue,
} from '@/lib/offline-report-queue';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

function getOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(getOnlineStatus);

  useEffect(() => {
    const update = () => setIsOnline(getOnlineStatus());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return isOnline;
}

export function useOfflineReportQueueStatus() {
  const [queue, setQueue] = useState(() => getOfflineReportQueue());

  useEffect(() => subscribeToOfflineReportQueue(() => setQueue(getOfflineReportQueue())), []);

  return useMemo(
    () => ({
      pendingCount: queue.length,
      staffPendingCount: queue.filter((item) => item.kind === 'staff-report').length,
      bystanderPendingCount: queue.filter((item) => item.kind === 'bystander-report').length,
      queue,
    }),
    [queue]
  );
}

export function useOfflineReportSync() {
  const isOnline = useOnlineStatus();
  const syncingRef = useRef(false);
  const [syncSignal, setSyncSignal] = useState(0);
  const { pendingCount } = useOfflineReportQueueStatus();

  useEffect(() => {
    const triggerSync = () => setSyncSignal((value) => value + 1);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, triggerSync);
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, triggerSync);
  }, []);

  useEffect(() => {
    if (!isOnline || syncingRef.current || pendingCount === 0) return;

    let cancelled = false;

    async function syncQueue() {
      syncingRef.current = true;
      let synced = 0;

      for (const item of getOfflineReportQueue()) {
        if (cancelled || !getOnlineStatus()) break;

        try {
          if (item.kind === 'staff-report') {
            await createReport(item.payload);
          } else {
            await createBystanderReport(item.payload);
          }
          removeOfflineReport(item.id);
          synced += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to sync report.';
          markOfflineReportAttempt(item.id, message);

          if (/unauthorized|forbidden/i.test(message)) {
            break;
          }
        }
      }

      if (!cancelled && synced > 0) {
        toast.success(`${synced} offline ${synced === 1 ? 'report' : 'reports'} synced`);
      }

      syncingRef.current = false;
    }

    syncQueue();

    return () => {
      cancelled = true;
      syncingRef.current = false;
    };
  }, [isOnline, pendingCount, syncSignal]);
}
