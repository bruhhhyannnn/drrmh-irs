import { create } from 'zustand';

interface OfflineQueueState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  /** When the provider last tried to send the queue. */
  lastAttemptAt: number | null;
  /** When a queued field report last went through. */
  lastFieldSyncAt: number | null;
  /** Sends the queue now instead of waiting for the next retry. Set by OfflineQueueProvider. */
  flushNow: () => void;
  setOnline: (isOnline: boolean) => void;
  setPendingCount: (pendingCount: number) => void;
  setSyncing: (isSyncing: boolean) => void;
}

// Starts optimistically online — `navigator.onLine` can be unreliable/stale on first paint,
// and OfflineQueueProvider corrects it (and the pending count) immediately on mount.
export const useOfflineQueueStore = create<OfflineQueueState>((set) => ({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  lastAttemptAt: null,
  lastFieldSyncAt: null,
  flushNow: () => {},
  setOnline: (isOnline) => set({ isOnline }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSyncing: (isSyncing) => set({ isSyncing }),
}));
