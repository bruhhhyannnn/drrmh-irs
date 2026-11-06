'use client';

import { useScopedCampusId } from '@/app/(admin)/_components/shell/campus-switcher';
import { FOCUS_RING } from '@/components/ds';
import { useCampuses } from '@/components/hooks/use-campus';
import { cn } from '@/lib';
import { useAuthStore, useCampusScopeStore } from '@/store';

/**
 * Super Admins pick from All campuses or any campus.
 * Administrators see their own campus name as plain text.
 */
export function CampusPicker() {
  const isSuperAdmin = useAuthStore((s) => s.userProfile?.user_type?.name === 'Super Admin');
  const ownCampusName = useAuthStore((s) => s.userProfile?.campus?.name);
  const campusId = useScopedCampusId();
  const setCampusId = useCampusScopeStore((s) => s.setCampusId);
  const { data: campuses = [] } = useCampuses();

  if (!isSuperAdmin) {
    return (
      <span className="text-[14px] font-semibold text-gray-700">
        {ownCampusName ?? 'Assigned campus'}
      </span>
    );
  }

  const active = campuses.filter((c) => c.is_active || c.id === campusId);

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Campus scope</span>
      <select
        aria-label="Campus scope"
        value={campusId}
        onChange={(e) => setCampusId(e.target.value)}
        className={cn(
          'rounded-xl border border-gray-300 bg-surface px-3 py-1.5 text-[14px] font-semibold text-gray-700 shadow-xs',
          FOCUS_RING
        )}
      >
        <option value="">All campuses</option>
        {active.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
