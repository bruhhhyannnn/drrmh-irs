import type { Prisma } from '@prisma/client';
import { adminScope, type AdminScope } from './admin-scope';
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

const PROFILE_TTL_MS = 15_000;
const profileCache = new Map<string, { expires: number; promise: Promise<CallerCheck> }>();

async function verifyCaller(token: string): Promise<CallerCheck> {
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

export async function requireProfile(token: string | null | undefined): Promise<CallerCheck> {
  if (!token) return { ok: false, reason: 'signed_out' };

  const now = Date.now();
  const hit = profileCache.get(token);
  if (hit && hit.expires > now) return hit.promise;

  if (profileCache.size >= 100) {
    for (const [k, v] of profileCache) {
      if (v.expires <= now) profileCache.delete(k);
    }
  }

  const promise = verifyCaller(token)
    .then((res) => {
      if (!res.ok) profileCache.delete(token);
      return res;
    })
    .catch((err) => {
      profileCache.delete(token);
      throw err;
    });
  profileCache.set(token, { expires: now + PROFILE_TTL_MS, promise });
  return promise;
}

/** An admin caller and the campus they may read (adminScope); `{ ok: false }` for anyone else. */
export async function requireAdmin(
  token: string | null | undefined,
  requestedCampusId?: string | null
): Promise<
  { ok: true; profile: VerifiedProfile; scope: AdminScope & { ok: true } } | { ok: false }
> {
  const caller = await requireProfile(token);
  if (!caller.ok) return { ok: false };
  const scope = adminScope(caller.profile, requestedCampusId);
  if (!scope.ok) return { ok: false };
  return { ok: true, profile: caller.profile, scope };
}
