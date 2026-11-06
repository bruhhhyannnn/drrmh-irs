'use server';

import { isAdminUserType } from '@/lib';
import { inScope } from '@/lib/admin-scope';
import { clusterIdForName, positionIdForName, unitIdForName } from '@/lib/lookup-names';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { offCampusProfileSchema, type OffCampusProfileFormData } from '@/lib/schemas';
import { requireAdmin, requireProfile } from '@/lib/server-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { canAssignUserType, canManageUser } from '@/lib/user-access';
import { withoutAssignment } from '@/lib/user-assignment';
import { revalidatePath } from 'next/cache';

export type CreateUserInput = {
  password: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  suffix?: string | null;
  username: string;
  email: string;
  cluster_id?: string | null;
  unit_id?: string | null;
  position_id?: string | null;
  user_type_id: string;
  is_active?: boolean;
  /** null for an off-campus account. */
  campus_id: string | null;
  /** DRRM-026: someone outside UP. Only a Super Admin may make one, and only as an ERT Member. */
  is_off_campus?: boolean;
  address?: string | null;
  organization?: string | null;
  organization_address?: string | null;
  position_title?: string | null;
  /** "Other (please specify)": a unit in `cluster_id` or a position not in the list yet. */
  custom_unit_name?: string | null;
  custom_position_name?: string | null;
};

export type UpdateUserInput = Omit<Partial<CreateUserInput>, 'password'>;

/** Swaps typed unit / position names for ids, adding the unit or position when it's new. */
async function withNamedAssignment<T extends UpdateUserInput>(data: T) {
  const { custom_unit_name, custom_position_name, ...rest } = data;
  const unitName = custom_unit_name?.trim();
  const positionName = custom_position_name?.trim();
  return {
    ...rest,
    ...(unitName && rest.cluster_id
      ? { unit_id: await unitIdForName(rest.cluster_id, unitName) }
      : {}),
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
  if (!caller.ok) throw new Error(SIGN_IN_AS_ADMIN);
  return caller;
}

/** The account if this admin may change it; a thrown refusal otherwise. */
async function manageableUser(scope: Parameters<typeof canManageUser>[0], id: string) {
  const target = await prisma.user.findUnique({
    where: { id },
    select: { campus_id: true, is_off_campus: true, user_type: { select: { name: true } } },
  });
  if (!target || !canManageUser(scope, target)) throw new Error(NOT_YOURS);
  return target;
}

/** A user type the caller may give, by id; a thrown refusal otherwise. */
async function assignableType(scope: Parameters<typeof canAssignUserType>[0], typeId: string) {
  const type = await prisma.userType.findUnique({ where: { id: typeId }, select: { name: true } });
  if (!canAssignUserType(scope, type?.name)) throw new Error("You can't give that user type.");
  return type!.name;
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
  if (!caller.ok) return null;
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
 * The signed-in person's own profile, found from their verified token. Unlike requireProfile it
 * also returns an inactive account, so the app can say so instead of failing to load.
 */
export async function getMyProfile(token: string | null) {
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return prisma.user.findUnique({
    where: { auth_id: data.user.id },
    include: {
      cluster: true,
      unit: { include: { cluster: true } },
      position: true,
      user_type: true,
      campus: true,
    },
  });
}

/**
 * Makes an account. The caller must be an admin: an Administrator only on their own campus and
 * never a Super Admin; only a Super Admin may make an off-campus account (DRRM-026), which has no
 * campus an Administrator could be responsible for.
 */
export async function createUser(data: CreateUserInput, token: string | null) {
  const { password, ...named } = data;
  const caller = await adminCaller(token, named.campus_id);
  const typeName = await assignableType(caller.scope, named.user_type_id);

  if (named.is_off_campus) {
    if (caller.scope.role !== 'super_admin') {
      throw new Error('Only a super admin can make an off-campus account.');
    }
    if (typeName !== 'ERT Member') {
      throw new Error('Only an ERT member account can be off campus.');
    }
  }
  // An Administrator's new account is on their own campus, whatever the request says.
  const campusId = caller.scope.role === 'administrator' ? caller.scope.campusId : named.campus_id;
  const profileData = named.is_off_campus
    ? { ...withoutAssignment(named), is_off_campus: true }
    : await withNamedAssignment({ ...named, campus_id: campusId, is_off_campus: false });
  const is_profile_complete = isAdminUserType(typeName);

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: profileData.email,
    password,
    email_confirm: true, // skip confirmation email, admin is creating the account
  });

  if (authError) throw new Error(authError.message);

  const auth_id = authData.user.id;

  try {
    const user = await prisma.user.create({
      data: { ...profileData, auth_id, is_profile_complete },
    });
    revalidatePath('/users');
    return user;
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(auth_id);
    throw toFriendlyError(err, 'user');
  }
}

export async function updateUser(token: string | null, id: string, data: UpdateUserInput) {
  const caller = await adminCaller(token);
  const current = await manageableUser(caller.scope, id);
  if (data.user_type_id) await assignableType(caller.scope, data.user_type_id);
  try {
    // Whether an account is off campus is fixed when it's made, and an Administrator can't move
    // an account to another campus.
    const { is_off_campus: _fixed, ...rest } = data;
    const campusId =
      caller.scope.role === 'administrator' ? caller.scope.campusId : rest.campus_id || undefined;
    const user = await prisma.user.update({
      where: { id },
      data: current.is_off_campus
        ? withoutAssignment(rest)
        : await withNamedAssignment({ ...rest, campus_id: campusId }),
    });
    revalidatePath('/users');
    return user;
  } catch (err) {
    throw toFriendlyError(err, 'user');
  }
}

/** The Active switch on the Users list (and its Undo). */
export async function setUserActive(token: string | null, id: string, isActive: boolean) {
  const caller = await adminCaller(token);
  await manageableUser(caller.scope, id);
  try {
    const user = await prisma.user.update({
      where: { id },
      data: { is_active: isActive },
    });
    revalidatePath('/users');
    return user;
  } catch (err) {
    throw toFriendlyError(err, 'user');
  }
}

/**
 * Profile setup's save. A typed cluster ("Other (please specify)") is found or added on the
 * campus first, so a typed unit lands in it. A cluster name another campus already has comes
 * back as `ok: false` rather than thrown, because production hides a thrown message.
 */
export async function completeUserProfile(
  token: string | null,
  data: {
    position_id?: string;
    custom_position_name?: string;
    first_name?: string;
    last_name?: string;
    cluster_id?: string;
    custom_cluster_name?: string;
    unit_id?: string;
    custom_unit_name?: string;
    campus_id?: string;
  }
) {
  // Always the signed-in person's own profile, never an id the client sends.
  const caller = await requireProfile(token);
  if (!caller.ok) return { ok: false as const, error: 'Sign in again to save your profile.' };
  const id = caller.profile.id;
  const { custom_cluster_name, ...rest } = data;
  if (!rest.campus_id) {
    throw new Error('campus_id is required to complete profile');
  }

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

  const user = await prisma.user.update({
    where: { id },
    data: { ...(await withNamedAssignment(rest)), is_profile_complete: true },
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
