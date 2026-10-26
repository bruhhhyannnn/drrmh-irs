import { USER_TYPES } from './constants';

// Which campus an admin may read assessments of (spec 5.6, 5.7). An Administrator always gets
// their own campus, whatever campus the request names; a Super Admin gets the one asked for, or
// all of them. Decided on the server from the verified profile (requireAdmin in server-auth.ts).

export type AdminScope =
  { ok: true; role: 'administrator' | 'super_admin'; campusId: string | null } | { ok: false };

export function adminScope(
  profile: { user_type?: { name: string } | null; campus_id: string | null },
  requestedCampusId?: string | null
): AdminScope {
  const type = profile.user_type?.name;
  if (type === USER_TYPES[3]) {
    return { ok: true, role: 'super_admin', campusId: requestedCampusId || null };
  }
  if (type === USER_TYPES[2] && profile.campus_id) {
    return { ok: true, role: 'administrator', campusId: profile.campus_id };
  }
  return { ok: false };
}

/** Whether a record at `campusId` is visible; `campusId: null` in the scope means all campuses. */
export function inScope(scope: AdminScope & { ok: true }, campusId: string): boolean {
  return scope.campusId === null || scope.campusId === campusId;
}
