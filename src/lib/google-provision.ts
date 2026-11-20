// Who may get or link an app profile after a Google sign-in (#100). Decided only from the user
// Supabase verified for the caller's token, never from values the browser sends.

/** The UP Workspace domain every Google-provisioned account must belong to. */
export const UP_EMAIL_DOMAIN = '@up.edu.ph';

interface VerifiedUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  app_metadata?: { provider?: string; providers?: string[] } | null;
  user_metadata?: Record<string, unknown> | null;
}

export type GoogleIdentity =
  | { ok: true; authId: string; email: string; fullName: string | null }
  | { ok: false; reason: 'domain' | 'not_google' };

/**
 * The verified Google identity to provision, or why not: the email must be confirmed and on
 * `@up.edu.ph`, and the account must have signed in with Google (`hd` on the button is only a
 * hint to Google's account picker, so it proves nothing).
 */
export function googleIdentity(user: VerifiedUser): GoogleIdentity {
  const providers = user.app_metadata?.providers ?? [user.app_metadata?.provider];
  if (!providers.includes('google') || !user.email_confirmed_at) {
    return { ok: false, reason: 'not_google' };
  }
  const email = user.email?.trim().toLowerCase() ?? '';
  if (!email.endsWith(UP_EMAIL_DOMAIN) || email.length <= UP_EMAIL_DOMAIN.length) {
    return { ok: false, reason: 'domain' };
  }
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
  return {
    ok: true,
    authId: user.id,
    email,
    fullName: typeof name === 'string' && name.trim() ? name.trim().slice(0, 200) : null,
  };
}

/** First and last name from Google's full name ("Juan Dela Cruz" → Juan, Dela Cruz). */
export function splitFullName(fullName: string | null): { first: string; last: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

/** A unique username: the email's local part plus the first 6 hex of the auth id. */
export function usernameFor(email: string, authId: string): string {
  const local = email
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  return `${local}-${authId.replace(/-/g, '').slice(0, 6)}`;
}
