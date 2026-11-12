'use client';

import { useCampusesOverview } from '@/components/hooks/use-campus';
import { useAuthStore } from '@/store';
import { useIsSuperAdmin } from './campus-switcher';
import { navFor } from './nav';

/** The nav for the signed-in admin (their own campus for administrators). */
export function useNav() {
  const isSuperAdmin = useIsSuperAdmin();
  const campus = useAuthStore((s) => s.userProfile?.campus ?? null);
  return navFor(isSuperAdmin, campus && { id: campus.id, name: campus.name });
}

export interface SidebarCampus {
  id: string;
  name: string;
  /** It has an ongoing event. */
  live: boolean;
}

/**
 * The super admin sidebar's campuses: those with events, most events first, then by name, so
 * the order holds still; `total` is every campus, for All campuses.
 */
export function useSidebarCampuses(enabled: boolean) {
  const { data = [] } = useCampusesOverview({ enabled });
  const campuses: SidebarCampus[] = data
    .filter((c) => c._count.events > 0)
    .sort((a, b) => b._count.events - a._count.events || a.name.localeCompare(b.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      live: c.latestEvent?.status.name.toLowerCase() === 'ongoing',
    }));
  return { campuses, total: data.length };
}
