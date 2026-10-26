'use client';

import { getQueuedFieldReports, type QueuedFieldReport } from '@/lib/offline-queue';
import { useOfflineQueueStore } from '@/store';
import { useEffect, useState } from 'react';

/**
 * Field reports saved on this device, oldest first. Re-read whenever the queue count changes
 * or a send attempt starts or ends.
 */
export function useFieldQueue() {
  const pendingCount = useOfflineQueueStore((s) => s.pendingCount);
  const isSyncing = useOfflineQueueStore((s) => s.isSyncing);
  const [entries, setEntries] = useState<QueuedFieldReport[]>([]);

  useEffect(() => {
    let active = true;
    getQueuedFieldReports()
      .then((list) => {
        if (active) setEntries([...list].sort((a, b) => a.createdAt - b.createdAt));
      })
      .catch(() => {
        // IndexedDB unavailable — nothing can be queued here either
      });
    return () => {
      active = false;
    };
  }, [pendingCount, isSyncing]);

  return entries;
}

export function queuedHeadcount(entry: QueuedFieldReport) {
  return entry.payload.population_counts.reduce((sum, c) => sum + c.count, 0);
}
