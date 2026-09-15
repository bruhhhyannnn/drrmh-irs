import { create } from 'zustand';

interface OfflineQueueState {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
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
  setOnline: (isOnline) => set({ isOnline }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSyncing: (isSyncing) => set({ isSyncing }),
}));
