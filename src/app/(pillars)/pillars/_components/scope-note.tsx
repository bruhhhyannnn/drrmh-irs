'use client';

import { useScopedCampusId } from '@/app/(admin)/_components/shell/campus-switcher';
import { useCampuses } from '@/components/hooks/use-campus';

/** Which campus's results these are. This route has no switcher, so it says so in words. */
export function ScopeNote() {
  const campusId = useScopedCampusId();
  const { data: campuses } = useCampuses();
  const name = campusId ? campuses?.find((c) => c.id === campusId)?.name : 'All campuses';
  return <p className="text-[14px] text-gray-600">Showing: {name ?? '…'}</p>;
}
