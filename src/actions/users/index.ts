'use server';

import { isAdminUserType } from '@/lib';
import { positionIdForName, unitIdForName } from '@/lib/lookup-names';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { supabaseAdmin } from '@/lib/supabase-admin';
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
  campus_id: string;
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

export async function getUsers(query?: string, campusId?: string) {
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
      ...(campusId ? { campus_id: campusId } : {}),
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

export async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      cluster: true,
      unit: { include: { cluster: true } },
      position: true,
      user_type: true,
      campus: true,
    },
  });
}

export async function getUserByAuthId(authId: string) {
  return prisma.user.findUnique({
    where: { auth_id: authId },
    include: {
      cluster: true,
      unit: { include: { cluster: true } },
      position: true,
      user_type: true,
      campus: true,
    },
  });
}

export async function createUser(data: CreateUserInput) {
  const { password, ...named } = data;
  const profileData = await withNamedAssignment(named);

  const userType = await prisma.userType.findUnique({
    where: { id: profileData.user_type_id },
    select: { name: true },
  });
  const is_profile_complete = isAdminUserType(userType?.name);

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

export async function updateUser(id: string, data: UpdateUserInput) {
  try {
    const user = await prisma.user.update({
      where: { id },
      data: await withNamedAssignment(data),
    });
    revalidatePath('/users');
    return user;
  } catch (err) {
    throw toFriendlyError(err, 'user');
  }
}

/** The Active switch on the Users list (and its Undo). */
export async function setUserActive(id: string, isActive: boolean) {
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

export async function completeUserProfile(
  id: string,
  data: {
    position_id?: string;
    custom_position_name?: string;
    first_name?: string;
    last_name?: string;
    cluster_id?: string;
    unit_id?: string;
    custom_unit_name?: string;
    campus_id?: string;
  }
) {
  if (!data.campus_id) {
    throw new Error('campus_id is required to complete profile');
  }

  const user = await prisma.user.update({
    where: { id },
    data: { ...(await withNamedAssignment(data)), is_profile_complete: true },
    include: {
      cluster: true,
      unit: { include: { cluster: true } },
      position: true,
      user_type: true,
      campus: true,
    },
  });
  revalidatePath('/');
  return user;
}

export type DeleteUserResult = { ok: true } | { ok: false; error: string };

/**
 * Deletes the profile, then its sign-in. Their reports and the events they created stay, without
 * a reporter or creator. Someone who evaluated building assessments can't be deleted, since each
 * assessment keeps its evaluator: that comes back as `ok: false` rather than thrown, because
 * production hides a thrown message.
 */
export async function deleteUser(id: string): Promise<DeleteUserResult> {
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
