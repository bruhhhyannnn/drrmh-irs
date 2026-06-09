import type { Session } from '@supabase/supabase-js';

export const AUTH_TOKEN_COOKIE = 'irs-sb-access-token';
export const AUTH_SESSION_CHANGED_EVENT = 'irs-auth-session-changed';

function emitAuthSessionChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
  }
}

export function syncSupabaseAuthCookie(
  session: Pick<Session, 'access_token' | 'expires_at'> | null
) {
  if (typeof document === 'undefined') return;

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';

  if (!session?.access_token) {
    document.cookie = `${AUTH_TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    emitAuthSessionChanged();
    return;
  }

  const expiresAt = session.expires_at ?? Math.floor(Date.now() / 1000) + 60 * 60;
  const maxAge = Math.max(expiresAt - Math.floor(Date.now() / 1000), 0);
  document.cookie = `${AUTH_TOKEN_COOKIE}=${encodeURIComponent(
    session.access_token
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  emitAuthSessionChanged();
}
