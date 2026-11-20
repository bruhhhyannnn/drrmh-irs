import { isAdminUserType } from './constants';

// Who can use the building assessment (spec 5.6). This is the one place the rule lives: the /home
// card, the top-bar switch, the /assessment page guard and the server actions all call it.

type AccessProfile = {
  user_type?: { name: string } | null;
  position?: { name: string } | null;
  is_off_campus?: boolean | null;
};

/** Shown wherever the Report tool would be, for an off-campus account (DRRM-026). */
export const REPORT_OFF_CAMPUS_MESSAGE = 'Not available for off-campus accounts';

/** Field reports need a UP cluster, which an off-campus account doesn't have (DRRM-026). */
export function canUseReport(p: AccessProfile | null | undefined): boolean {
  return !p?.is_off_campus;
}

// Phase 1: every ERT member. Later: ERT member AND position is Safety Officer.
export function canUseAssessment(p: AccessProfile | null | undefined): boolean {
  return p?.user_type?.name === 'ERT Member';
  // && ASSESSMENT_POSITIONS.includes(p.position?.name ?? '')
}

/** Where someone of this user type belongs: admins on the dashboard, anyone else on /home. */
export function homePathFor(userTypeName?: string | null): '/dashboard' | '/home' {
  return isAdminUserType(userTypeName) ? '/dashboard' : '/home';
}

/** Stands in for the app's origin when resolving `from`; never navigated to. */
const APP_ORIGIN = 'https://app.invalid';

/**
 * Where sign-in sends someone. `from` is the admin page they were turned away from, so only an
 * admin goes back to it, and only if it is a path inside the app other than sign-in itself.
 * `from` is resolved the way the browser will resolve it (#110): the URL parser drops tabs and
 * newlines, so `/<tab>/evil.example` would become `//evil.example`, another site. Anything with a
 * control character or a backslash is refused, and only a path that stays on this origin is kept,
 * rebuilt from its parts.
 */
export function signInDestination(userTypeName?: string | null, from?: string | null): string {
  const home = homePathFor(userTypeName);
  if (home !== '/dashboard' || !from) return home;
  if (!from.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(from)) return home;
  let url: URL;
  try {
    url = new URL(from, APP_ORIGIN);
  } catch {
    return home;
  }
  if (url.origin !== APP_ORIGIN || /^\/signin(?:\/|$)/.test(url.pathname)) return home;
  return `${url.pathname}${url.search}${url.hash}`;
}

type GuardInput = {
  loading: boolean;
  hasUser: boolean;
  profile: (AccessProfile & { is_profile_complete?: boolean }) | null;
  profileError: string | null;
};

/**
 * What an admin page does on this render. Decided during render, not in an effect: a child's
 * effects run first, so anything but `allow` must keep the admin pages from mounting at all.
 */
export type AdminGuard =
  { status: 'checking' | 'error' | 'signin' | 'allow' } | { status: 'redirect'; to: string };

export function adminGuard({ loading, hasUser, profile, profileError }: GuardInput): AdminGuard {
  if (profileError) return { status: 'error' };
  if (loading) return { status: 'checking' };
  if (!hasUser) return { status: 'signin' };
  if (!profile) return { status: 'checking' };
  const home = homePathFor(profile.user_type?.name);
  return home === '/dashboard' ? { status: 'allow' } : { status: 'redirect', to: home };
}

/** What an ERT page does on this render; `setup` shows ProfileSetup in the page's place. */
export type ErtGuard =
  { status: 'checking' | 'error' | 'setup' | 'ready' } | { status: 'redirect'; to: string };

export function ertGuard(
  { loading, hasUser, profile, profileError }: GuardInput,
  { requireAssessment = false }: { requireAssessment?: boolean } = {}
): ErtGuard {
  if (profileError) return { status: 'error' };
  if (loading) return { status: 'checking' };
  if (!hasUser) return { status: 'redirect', to: '/signin' };
  if (!profile) return { status: 'checking' };
  if (isAdminUserType(profile.user_type?.name)) return { status: 'redirect', to: '/dashboard' };
  if (requireAssessment && !canUseAssessment(profile)) return { status: 'redirect', to: '/home' };
  return profile.is_profile_complete ? { status: 'ready' } : { status: 'setup' };
}
