'use server';

import { googleIdentity, splitFullName, usernameFor } from '@/lib/google-provision';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Prisma } from '@prisma/client';

export type ProvisionResult =
  | { ok: true; userTypeName: string }
  /**
   * `signed_out`: no valid session. `domain`: not a `@up.edu.ph` Google account. `taken`: a
   * profile with this email already belongs to another sign-in. `setup`: anything else.
   */
  | { ok: false; reason: 'signed_out' | 'domain' | 'taken' | 'setup' };

/**
 * After a Google sign-in: the caller's profile, made or linked when it's their first time. Who
 * they are comes only from their verified token (#100), never from the browser. A profile that
 * already has this email is linked only when the sign-in it points at no longer exists, so an
 * existing account can't be taken over by re-binding it. Failures come back as `ok: false`
 * rather than thrown, because production hides a thrown message.
 */
export async function provisionGoogleUser(token: string | null): Promise<ProvisionResult> {
  if (!token) return { ok: false, reason: 'signed_out' };
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { ok: false, reason: 'signed_out' };

  const identity = googleIdentity(data.user);
  if (!identity.ok) return { ok: false, reason: 'domain' };
  const { authId, email, fullName } = identity;

  try {
    // A returning user.
    const existing = await prisma.user.findUnique({
      where: { auth_id: authId },
      include: { user_type: true },
    });
    if (existing) return { ok: true, userTypeName: existing.user_type.name };

    const linked = await linkByEmail(authId, email);
    if (linked) return linked;

    const ertType = await prisma.userType.findFirst({ where: { name: 'ERT Member' } });
    if (!ertType) return { ok: false, reason: 'setup' };
    const { first, last } = splitFullName(fullName);
    try {
      const created = await prisma.user.create({
        data: {
          auth_id: authId,
          email,
          username: usernameFor(email, authId),
          first_name: first,
          last_name: last,
          user_type_id: ertType.id,
          is_active: true,
        },
        include: { user_type: true },
      });
      return { ok: true, userTypeName: created.user_type.name };
    } catch (err) {
      // Someone made a profile with this email a moment ago: the same rules apply to it.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return (await linkByEmail(authId, email)) ?? { ok: false, reason: 'setup' };
      }
      throw err;
    }
  } catch (err) {
    console.error('provisionGoogleUser failed:', err);
    return { ok: false, reason: 'setup' };
  }
}

/**
 * The profile with this email, linked to `authId`, when there is one. It is re-linked only when
 * the sign-in it points at was deleted from Supabase Auth; otherwise it belongs to someone else's
 * sign-in and the answer is `taken`. Null when no profile has this email.
 */
async function linkByEmail(authId: string, email: string): Promise<ProvisionResult | null> {
  const byEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, auth_id: true },
  });
  if (!byEmail) return null;
  if (byEmail.auth_id !== authId) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(byEmail.auth_id);
    // Only "this sign-in doesn't exist" frees the profile; an outage must not.
    const gone = !data?.user && (error?.status === 404 || /not.?found/i.test(error?.message ?? ''));
    if (!gone) return { ok: false, reason: 'taken' };
  }
  const updated = await prisma.user.update({
    where: { id: byEmail.id },
    data: { auth_id: authId },
    include: { user_type: true },
  });
  return { ok: true, userTypeName: updated.user_type.name };
}
