'use server';

import { isAdminUserType } from '@/lib';
import { inScope } from '@/lib/admin-scope';
import { avatarsFor, myAvatar, saveAvatar, saveShowAvatar } from '@/lib/avatars';
import { googlePhoto } from '@/lib/google-photo';
import { clusterIdForName, positionIdForName, unitIdForName } from '@/lib/lookup-names';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import {
  completeProfileSchema,
  offCampusProfileSchema,
  userCreateInputSchema,
  userUpdateInputSchema,
  type CompleteProfileInput,
  type OffCampusProfileFormData,
  type UserCreateInput,
  type UserUpdateInput,
} from '@/lib/schemas';
import { requireAdmin, requireProfile } from '@/lib/server-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAssignUserType, canManageUser, signInBanWarning } from '@/lib/user-access';
import { withoutAssignment } from '@/lib/user-assignment';
import { isUuid } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';

/** What Add user sends. Parsed on the server with `userCreateInputSchema` (#101). */
export type CreateUserInput = UserCreateInput;
/** What Edit user sends. Parsed on the server with `userUpdateInputSchema` (#101). */
export type UpdateUserInput = UserUpdateInput;

/** A refusal the Users page shows; production hides thrown messages, so it is returned. */
type Refusal = { ok: false; error: string };
class UserRefusal extends Error {}

/** The first problem zod found, worded for the person filling in the form. */
const firstIssue = (error: z.ZodError, fallback: string) => error.issues[0]?.message ?? fallback;

/**
 * Checks a campus / cluster / unit combination before anything is saved or added (#86): the
 * cluster must be on the campus and the unit in the cluster. A refusal is thrown as a
 * `UserRefusal`, which the actions return as `ok: false`.
 */
async function checkAssignment(
  campusId: string | null | undefined,
  clusterId: string | null | undefined,
  unitId: string | null | undefined
) {
  if (clusterId) {
    const cluster = await prisma.cluster.findUnique({
      where: { id: clusterId },
      select: { campus_id: true },
    });
    if (!cluster || !campusId || cluster.campus_id !== campusId) {
      throw new UserRefusal('That cluster is not on this campus. Pick the cluster again.');
    }
  }
  if (unitId) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { cluster_id: true },
    });
    if (!unit || !clusterId || unit.cluster_id !== clusterId) {
      throw new UserRefusal('That unit is not in this cluster. Pick the unit again.');
    }
  }
}

type NamedAssignment = {
  campus_id?: string | null;
  cluster_id?: string | null;
  unit_id?: string | null;
  position_id?: string | null;
  custom_unit_name?: string | null;
  custom_position_name?: string | null;
};

/**
 * Swaps typed unit / position names for ids, adding the unit or position when it's new. The
 * campus, cluster and unit are checked first (`checkAssignment`), so nothing is added to a
 * cluster on another campus. `current` is the account's saved assignment, for an edit that
 * leaves some of it out.
 */
async function withNamedAssignment<T extends NamedAssignment>(
  data: T,
  current: { campus_id: string | null; cluster_id: string | null } = {
    campus_id: null,
    cluster_id: null,
  }
) {
  const { custom_unit_name, custom_position_name, ...rest } = data;
  const unitName = custom_unit_name?.trim();
  const positionName = custom_position_name?.trim();
  const campusId = rest.campus_id !== undefined ? rest.campus_id : current.campus_id;
  const clusterId = rest.cluster_id !== undefined ? rest.cluster_id : current.cluster_id;
  await checkAssignment(campusId, clusterId, unitName ? null : rest.unit_id);
  if (unitName && !clusterId) throw new UserRefusal('Pick a cluster for the new unit.');
  return {
    ...rest,
    ...(unitName && clusterId ? { unit_id: await unitIdForName(clusterId, unitName) } : {}),
    ...(positionName ? { position_id: await positionIdForName(positionName) } : {}),
  };
}

// Every action here checks its caller on the server (security review of DRRM-025/026): an admin
// for the Users page, and the signed-in person for their own profile. The campus an Administrator
// works in comes from their verified profile, never from the request.

const SIGN_IN_AS_ADMIN = 'Sign in as an administrator to manage users.';
const NOT_YOURS = "You can't manage that account.";

async function adminCaller(token: string | null | undefined, campusId?: string | null) {
  const caller = await requireAdmin(token, campusId);
  if (!caller.ok) throw new UserRefusal(SIGN_IN_AS_ADMIN);
  return caller;
}

/** The account if this admin may change it; a thrown refusal otherwise. */
async function manageableUser(scope: Parameters<typeof canManageUser>[0], id: unknown) {
  if (!isUuid(id)) throw new UserRefusal(NOT_YOURS);
  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      campus_id: true,
      cluster_id: true,
      is_off_campus: true,
      user_type: { select: { name: true } },
    },
  });
  if (!target || !canManageUser(scope, target)) throw new UserRefusal(NOT_YOURS);
  return target;
}

/** A user type the caller may give, by id; a thrown refusal otherwise. */
async function assignableType(scope: Parameters<typeof canAssignUserType>[0], typeId: string) {
  const type = await prisma.userType.findUnique({ where: { id: typeId }, select: { name: true } });
  if (!canAssignUserType(scope, type?.name)) {
    throw new UserRefusal("You can't give that user type.");
  }
  return type!.name;
}

/** Runs a Users page write; a refusal, or a Prisma error worded for people, is `ok: false`. */
async function userWrite<T>(run: () => Promise<T>): Promise<{ ok: true; user: T } | Refusal> {
  try {
    return { ok: true, user: await run() };
  } catch (err) {
    if (err instanceof UserRefusal) return { ok: false, error: err.message };
    console.error('User write failed:', err);
    return { ok: false, error: toFriendlyError(err, 'user').message };
  }
}

/** The Users list: an Administrator's own campus, or for a Super Admin the one asked for (or all). */
export async function getUsers(token: string | null, query?: string, campusId?: string) {
  const caller = await requireAdmin(token, campusId || null);
  if (!caller.ok) return [];
  const scopeCampus = caller.scope.campusId;
  return prisma.user.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { first_name: { contains: query, mode: 'insensitive' } },
              { last_name: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { username: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(scopeCampus ? { campus_id: scopeCampus } : {}),
    },
    include: {
      cluster: true,
      unit: { include: { cluster: true } },
      position: true,
      user_type: true,
      campus: true,
      _count: { select: { reports: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

/** One account in the caller's scope; null otherwise. */
export async function getUser(token: string | null, id: string) {
  const caller = await requireAdmin(token);
  if (!caller.ok || !isUuid(id)) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      cluster: true,
      unit: { include: { cluster: true } },
      position: true,
      user_type: true,
      campus: true,
    },
  });
  return user && inScope(caller.scope, user.campus_id) ? user : null;
}

/**
 * The signed-in user's profile, found from the verified token. Also refreshes their Google
 * profile photo from that verified session (DRRM-039): email-and-password accounts get none.
 * `avatar` is the photo and their Show my Google photo choice.
 *
 * A turned-off account is banned (setUserActive), and Auth refuses a banned user's token even
 * before it expires, so `getUser` fails for it. That case returns `{ turnedOff: true }` with no
 * profile data, so the app can say the account is off; any other unverifiable token gives null.
 */
export async function getMyProfile(token: string | null) {
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error?.code === 'user_banned') return { turnedOff: true as const };
  if (error || !data.user) return null;
  const [profile] = await Promise.all([
    prisma.user.findUnique({
      where: { auth_id: data.user.id },
      include: {
        cluster: true,
        unit: { include: { cluster: true } },
        position: true,
        user_type: true,
        campus: true,
      },
    }),
    saveAvatar(data.user.id, googlePhoto(data.user)),
  ]);
  if (!profile) return null;
  return { ...profile, avatar: await myAvatar(data.user.id) };
}

/** Members' Google photos for the admin lists, by user id (only those who show theirs). */
export async function getAvatars(token: string | null, userIds: string[]) {
  const caller = await requireAdmin(token);
  if (!caller.ok) return {};
  return avatarsFor([...new Set(userIds)].slice(0, 200));
}

/** My profile → Show my Google photo. */
export async function setShowMyGooglePhoto(
  token: string | null,
  show: boolean
): Promise<{ ok: true } | { ok: false; error: string; retry: boolean }> {
  const caller = await requireProfile(token);
  if (!caller.ok) return { ok: false, error: 'Please sign in again.', retry: false };
  const saved = await saveShowAvatar(caller.profile.auth_id, show);
  return saved
    ? { ok: true }
    : {
        ok: false,
        error: 'That setting couldn’t be saved yet. Please try again later.',
        retry: true,
      };
}

/**
 * Makes an account. The caller must be an admin: an Administrator only on their own campus and
 * never a Super Admin; only a Super Admin may make an off-campus account (DRRM-026), which has no
 * campus an Administrator could be responsible for. The payload is parsed with a strict
 * allowlist first (#101), so only profile columns reach Prisma.
 */
export async function createUser(data: CreateUserInput, token: string | null) {
  return userWrite(async () => {
    const parsed = userCreateInputSchema.safeParse(data);
    if (!parsed.success) throw new UserRefusal(firstIssue(parsed.error, 'Check the details.'));
    const { password, ...named } = parsed.data;
    const caller = await adminCaller(token, named.campus_id);
    const typeName = await assignableType(caller.scope, named.user_type_id);

    if (named.is_off_campus) {
      if (caller.scope.role !== 'super_admin') {
        throw new UserRefusal('Only a super admin can make an off-campus account.');
      }
      if (typeName !== 'ERT Member') {
        throw new UserRefusal('Only an ERT member account can be off campus.');
      }
    }
    // An Administrator's new account is on their own campus, whatever the request says.
    const campusId =
      caller.scope.role === 'administrator' ? caller.scope.campusId : (named.campus_id ?? null);
    if (!named.is_off_campus && !campusId) throw new UserRefusal('Campus is required');
    const profileData = named.is_off_campus
      ? { ...withoutAssignment(named), is_off_campus: true }
      : await withNamedAssignment({ ...named, campus_id: campusId, is_off_campus: false });
    const is_profile_complete = isAdminUserType(typeName);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: profileData.email,
      password,
      email_confirm: true, // skip confirmation email, admin is creating the account
    });
    if (authError) throw new UserRefusal(authError.message);

    const auth_id = authData.user.id;
    try {
      const user = await prisma.user.create({
        data: { ...profileData, auth_id, is_profile_complete },
      });
      revalidatePath('/users');
      return user;
    } catch (err) {
      await supabaseAdmin.auth.admin.deleteUser(auth_id);
      throw err;
    }
  });
}

export async function updateUser(token: string | null, id: string, data: UpdateUserInput) {
  return userWrite(async () => {
    const parsed = userUpdateInputSchema.safeParse(data);
    if (!parsed.success) throw new UserRefusal(firstIssue(parsed.error, 'Check the details.'));
    const caller = await adminCaller(token);
    const current = await manageableUser(caller.scope, id);
    if (parsed.data.user_type_id) await assignableType(caller.scope, parsed.data.user_type_id);
    // Whether an account is off campus is fixed when it's made, and an Administrator can't move
    // an account to another campus.
    const { is_off_campus: _fixed, ...rest } = parsed.data;
    const campusId =
      caller.scope.role === 'administrator' ? caller.scope.campusId : rest.campus_id || undefined;
    const user = await prisma.user.update({
      where: { id },
      data: current.is_off_campus
        ? withoutAssignment(rest)
        : await withNamedAssignment({ ...rest, campus_id: campusId }, current),
    });
    revalidatePath('/users');
    return user;
  });
}

/** The Active switch on the Users list (and its Undo). */
export async function setUserActive(token: string | null, id: string, isActive: boolean) {
  return userWrite(async () => {
    const caller = await adminCaller(token);
    await manageableUser(caller.scope, id);
    // So a campus isn't left without its admin by a slip of the switch.
    if (!isActive && id === caller.profile.id) {
      throw new UserRefusal("You can't turn off your own account.");
    }
    const user = await prisma.user.update({
      where: { id },
      data: { is_active: isActive === true },
    });
    // Turning an account off also stops its sign-in (#104): Supabase refuses new sign-ins and
    // token refreshes for a banned user, so open sessions end within the hour. Turning it on
    // lifts the ban. The profile change stands even if this fails (requireProfile refuses an
    // inactive account either way), so the admin is told through `signInWarning` rather than an
    // error, which would wrongly say nothing changed.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.auth_id, {
      ban_duration: isActive === true ? 'none' : SIGN_IN_BAN,
    });
    if (error) console.error('Could not update the sign-in ban:', error.message);
    revalidatePath('/users');
    return { user, signInWarning: signInBanWarning(isActive === true, !!error) };
  });
}

/** How long a turned-off account's sign-in stays banned: until it is turned back on. */
const SIGN_IN_BAN = '876000h';

/**
 * Profile setup's save, for the signed-in person's own campus account, once (#101): an account
 * that finished setup, an admin, or an off-campus account is refused, so nobody can move
 * themselves to another campus through it. The payload is a strict allowlist, and the cluster
 * must be on the campus and the unit in the cluster before a typed name is added (#86). A typed
 * cluster ("Other (please specify)") is found or added on the campus first, so a typed unit lands
 * in it. Refusals come back as `ok: false` rather than thrown, because production hides a
 * thrown message.
 */
export async function completeUserProfile(token: string | null, data: CompleteProfileInput) {
  const caller = await requireProfile(token);
  if (!caller.ok) return { ok: false as const, error: 'Sign in again to save your profile.' };
  const { profile } = caller;
  if (profile.is_off_campus) {
    return { ok: false as const, error: 'This setup is only for campus accounts.' };
  }
  if (profile.is_profile_complete || isAdminUserType(profile.user_type?.name)) {
    return {
      ok: false as const,
      error: 'Your profile is already set up. Ask an administrator to change it.',
    };
  }
  const parsed = completeProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, error: firstIssue(parsed.error, 'Check your details.') };
  }
  const { custom_cluster_name, ...rest } = parsed.data;
  const campus = await prisma.campus.findUnique({
    where: { id: rest.campus_id },
    select: { is_active: true },
  });
  if (!campus?.is_active) return { ok: false as const, error: 'Choose your campus again.' };

  try {
    const clusterName = custom_cluster_name?.trim();
    if (clusterName) {
      const clusterId = await clusterIdForName(rest.campus_id, clusterName);
      if (!clusterId) {
        return {
          ok: false as const,
          error: `"${clusterName}" is a cluster on another campus. Check your campus, or add more detail to the cluster name.`,
        };
      }
      rest.cluster_id = clusterId;
    }
    const assignment = await withNamedAssignment(rest);
    const user = await prisma.user.update({
      where: { id: profile.id },
      data: {
        campus_id: assignment.campus_id,
        cluster_id: assignment.cluster_id ?? null,
        unit_id: assignment.unit_id ?? null,
        position_id: assignment.position_id ?? null,
        is_profile_complete: true,
      },
      include: {
        cluster: true,
        unit: { include: { cluster: true } },
        position: true,
        user_type: true,
        campus: true,
      },
    });
    revalidatePath('/');
    return { ok: true as const, user };
  } catch (err) {
    if (err instanceof UserRefusal) return { ok: false as const, error: err.message };
    throw err;
  }
}

/**
 * First sign-in setup for an off-campus account (DRRM-026): its name, address, organization and
 * position, with the data privacy consent. The caller is the verified token's own account.
 */
export async function completeOffCampusProfile(
  token: string | null,
  data: OffCampusProfileFormData
) {
  const caller = await requireProfile(token);
  if (!caller.ok) return { ok: false as const, error: 'Sign in again to save your profile.' };
  if (!caller.profile.is_off_campus) {
    return { ok: false as const, error: 'This setup is only for off-campus accounts.' };
  }
  const parsed = offCampusProfileSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Check your details.' };
  }
  const { consent: _consent, middle_name, suffix, ...fields } = parsed.data;
  const user = await prisma.user.update({
    where: { id: caller.profile.id },
    data: {
      ...fields,
      middle_name: middle_name || null,
      suffix: suffix || null,
      is_profile_complete: true,
    },
    include: {
      cluster: true,
      unit: { include: { cluster: true } },
      position: true,
      user_type: true,
      campus: true,
    },
  });
  revalidatePath('/');
  return { ok: true as const, user };
}

export type DeleteUserResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes the profile, then its sign-in. Their reports and the events they created stay, without
 * a reporter or creator. Someone who evaluated building assessments can't be deleted, since each
 * assessment keeps its evaluator: that comes back as `ok: false` rather than thrown, because
 * production hides a thrown message.
 */
export async function deleteUser(token: string | null, id: string): Promise<DeleteUserResult> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return { ok: false, error: SIGN_IN_AS_ADMIN };
  if (!isUuid(id)) return { ok: false, error: NOT_YOURS };
  if (id === caller.profile.id) return { ok: false, error: "You can't delete your own account." };
  const target = await prisma.user.findUnique({
    where: { id },
    select: { campus_id: true, is_off_campus: true, user_type: { select: { name: true } } },
  });
  if (target && !canManageUser(caller.scope, target)) return { ok: false, error: NOT_YOURS };
  const user = await prisma.user.findUnique({
    where: { id },
    select: { auth_id: true, _count: { select: { assessments: true } } },
  });
  if (!user) {
    return {
      ok: false,
      error: 'This user was already removed. Refresh the page to update the list.',
    };
  }
  const assessments = user._count.assessments;
  if (assessments > 0) {
    return {
      ok: false,
      error: `They evaluated ${assessments === 1 ? '1 building assessment' : `${assessments} building assessments`}, which keep their evaluator. Turn off Active instead, so they can no longer sign in.`,
    };
  }

  try {
    // One transaction, so a failed delete leaves their reports and events as they were.
    await prisma.$transaction([
      prisma.report.updateMany({ where: { user_id: id }, data: { user_id: null } }),
      prisma.event.updateMany({ where: { user_id: id }, data: { user_id: null } }),
      prisma.user.delete({ where: { id } }),
    ]);
  } catch (err) {
    throw toFriendlyError(err, 'user');
  }

  if (user.auth_id) {
    await supabaseAdmin.auth.admin.deleteUser(user.auth_id);
  }

  revalidatePath('/users');
  return { ok: true };
}
