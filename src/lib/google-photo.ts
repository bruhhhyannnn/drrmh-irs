// The Google profile photo of a signed-in user, from their verified Supabase session (DRRM-039).

/** Only photos Google serves are kept; anything else in the metadata is ignored. */
const GOOGLE_PHOTO_HOSTS = ['lh3.googleusercontent.com', 'googleusercontent.com'];

interface SessionUser {
  app_metadata?: { provider?: string; providers?: string[] } | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * The photo URL Google gave for this user (`avatar_url`, else `picture`), or null: an email and
 * password account has none, and a URL that isn't Google's isn't trusted.
 */
export function googlePhoto(user: SessionUser): string | null {
  const providers = user.app_metadata?.providers ?? [user.app_metadata?.provider];
  if (!providers.includes('google')) return null;
  const raw = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    const ok =
      url.protocol === 'https:' &&
      GOOGLE_PHOTO_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
    return ok ? url.toString() : null;
  } catch {
    return null;
  }
}
