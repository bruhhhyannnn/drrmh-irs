import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { supabaseAdmin } from './supabase-admin';

// Who is calling a server action, checked on the server (spec 5.6). The older actions trust the
// user id the client sends; these take the caller's Supabase access token, verify it with the
// service-role client and load the profile it belongs to. Import only from server actions.

const profileInclude = {
  user_type: true,
  position: true,
  campus: true,
  cluster: true,
  unit: { include: { cluster: true } },
} satisfies Prisma.UserInclude;

export type VerifiedProfile = Prisma.UserGetPayload<{ include: typeof profileInclude }>;

export type CallerCheck =
  | { ok: true; profile: VerifiedProfile }
  | { ok: false; reason: 'signed_out' | 'no_profile' }
  /** `profileId`: so a caller can tell the account's own data from someone else's. */
  | { ok: false; reason: 'inactive'; profileId: string };

export async function requireProfile(token: string | null | undefined): Promise<CallerCheck> {
  if (!token) return { ok: false, reason: 'signed_out' };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { ok: false, reason: 'signed_out' };

  const profile = await prisma.user.findUnique({
    where: { auth_id: data.user.id },
    include: profileInclude,
  });
  if (!profile) return { ok: false, reason: 'no_profile' };
  if (!profile.is_active) return { ok: false, reason: 'inactive', profileId: profile.id };
  return { ok: true, profile };
}
