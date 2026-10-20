'use client';

import { getQueuedAssessments, type QueuedAssessment } from '@/lib/offline-queue';
import { useOfflineQueueStore } from '@/store';
import { useEffect, useState } from 'react';

/**
 * Assessments saved on this device to send later, oldest first. Re-read whenever the queue
 * count changes, a send attempt starts or ends, or `refreshKey` changes (after a discard).
 */
export function useQueuedAssessments(refreshKey = 0) {
  const pendingCount = useOfflineQueueStore((s) => s.pendingCount);
  const isSyncing = useOfflineQueueStore((s) => s.isSyncing);
  const [entries, setEntries] = useState<QueuedAssessment[]>([]);

  useEffect(() => {
    let active = true;
    getQueuedAssessments()
      .then((list) => {
        if (active) setEntries([...list].sort((a, b) => a.createdAt - b.createdAt));
      })
      .catch(() => {
        // IndexedDB unavailable — nothing can be queued here either
      });
    return () => {
      active = false;
    };
  }, [pendingCount, isSyncing, refreshKey]);

  return entries;
}
