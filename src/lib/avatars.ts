import { prisma } from './prisma';

// Server-only: Google profile photos (DRRM-039). users.avatar_url and show_avatar are left out of
// default Prisma reads (src/lib/prisma.ts), so these read and write them with their own queries,
// and each one does nothing (or returns none) before prisma/manual/DRRM-039-avatar-url.sql runs.

/** Saves the photo from the verified session, only when it changed. Never throws. */
export async function saveAvatar(authId: string, url: string | null) {
  try {
    await prisma.$executeRaw`
      UPDATE public.users SET avatar_url = ${url}
      WHERE auth_id = ${authId}::uuid AND avatar_url IS DISTINCT FROM ${url}`;
  } catch (err) {
    console.error('Avatar could not be saved', err);
  }
}

/** The photos to show for these users (not those who turned it off), by user id. */
export async function avatarsFor(userIds: string[]): Promise<Record<string, string>> {
  if (!userIds.length) return {};
  try {
    const rows = await prisma.$queryRaw<{ id: string; avatar_url: string }[]>`
      SELECT id::text AS id, avatar_url FROM public.users
      WHERE id = ANY(${userIds}::uuid[]) AND show_avatar AND avatar_url IS NOT NULL`;
    return Object.fromEntries(rows.map((r) => [r.id, r.avatar_url]));
  } catch (err) {
    console.error('Avatars could not be read', err);
    return {};
  }
}

/** The signed-in user's photo and their Show my Google photo choice. */
export async function myAvatar(authId: string): Promise<{ url: string | null; show: boolean }> {
  try {
    const rows = await prisma.$queryRaw<{ avatar_url: string | null; show_avatar: boolean }[]>`
      SELECT avatar_url, show_avatar FROM public.users WHERE auth_id = ${authId}::uuid`;
    return { url: rows[0]?.avatar_url ?? null, show: rows[0]?.show_avatar ?? true };
  } catch {
    return { url: null, show: true };
  }
}

/** Show my Google photo: on or off. False when the column isn't there yet. */
export async function saveShowAvatar(authId: string, show: boolean): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      UPDATE public.users SET show_avatar = ${show} WHERE auth_id = ${authId}::uuid`;
    return true;
  } catch (err) {
    console.error('Show avatar could not be saved', err);
    return false;
  }
}
