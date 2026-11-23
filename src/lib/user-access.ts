import type { AdminScope } from './admin-scope';
import { USER_TYPES } from './constants';

// Who may read and change which accounts (Users page). The server decides from the verified
// caller's scope (requireAdmin), never from what the client sends.

type Scope = AdminScope & { ok: true };

type Target = {
  campus_id: string | null;
  user_type?: { name: string } | null;
  is_off_campus?: boolean | null;
};

/**
 * A Super Admin manages anyone. An Administrator manages accounts on their own campus, but never
 * a Super Admin or an off-campus account (which has no campus and only Super Admins oversee).
 */
export function canManageUser(scope: Scope, target: Target): boolean {
  if (scope.role === 'super_admin') return true;
  if (target.is_off_campus) return false;
  if (target.user_type?.name === USER_TYPES[3]) return false;
  return target.campus_id !== null && target.campus_id === scope.campusId;
}

/** Only a Super Admin may give the Super Admin type; nobody may give an unknown type. */
export function canAssignUserType(scope: Scope, typeName: string | null | undefined): boolean {
  const known = (Object.values(USER_TYPES) as string[]).includes(typeName ?? '');
  if (!known) return false;
  return typeName !== USER_TYPES[3] || scope.role === 'super_admin';
}

/**
 * What the Users page says when the sign-in ban could not be changed along with the Active switch
 * (#104). The profile change stands either way; null when the ban was updated.
 */
export function signInBanWarning(isActive: boolean, banFailed: boolean): string | null {
  if (!banFailed) return null;
  return isActive
    ? "The sign-in ban could not be lifted, so they still can't sign in. Turn the account on again to retry."
    : 'The sign-in ban could not be set, so they can still sign in. The app refuses them while the account is off, but turn it off again to retry.';
}
