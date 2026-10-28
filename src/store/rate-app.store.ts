import { hasRatedApp, RATED_APP_KEY } from '@/lib/rate-app';
import { create } from 'zustand';

interface RateAppState {
  /** A report just sent from this device and the app isn't rated yet: the popup shows. */
  asking: boolean;
  /** A report sent: now, or later from the offline queue. */
  reportSent: () => void;
  /** Not now or close: it asks again after the next report. */
  dismiss: () => void;
  /** The form was opened: it stops asking on this device. */
  markRated: () => void;
}

export const useRateAppStore = create<RateAppState>((set) => ({
  asking: false,
  reportSent: () => {
    if (!hasRatedApp()) set({ asking: true });
  },
  dismiss: () => set({ asking: false }),
  markRated: () => {
    try {
      localStorage.setItem(RATED_APP_KEY, '1');
    } catch {
      // Storage blocked: it may ask again after the next report.
    }
    set({ asking: false });
  },
}));
