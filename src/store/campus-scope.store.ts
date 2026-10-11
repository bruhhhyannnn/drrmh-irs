import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CampusScopeState {
  /** The campus picked in the admin top bar; '' means All campuses. */
  campusId: string;
  setCampusId: (campusId: string) => void;
}

/** The top-bar campus switcher. Every admin list and the dashboard read it. */
export const useCampusScopeStore = create<CampusScopeState>()(
  persist(
    (set) => ({
      campusId: '',
      setCampusId: (campusId) => set({ campusId }),
    }),
    { name: 'irs-admin-campus' }
  )
);
