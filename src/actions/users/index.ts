'use server';

import { prisma } from '@/lib/prisma';
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
};

export type UpdateUserInput = Omit<Partial<CreateUserInput>, 'password'>;

export async function getUsers(query?: string) {
  return prisma.user.findMany({
    where: query
      ? {
          OR: [
            { first_name: { contains: query, mode: 'insensitive' } },
            { last_name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { username: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: {
      cluster: true,
      unit: { include: { cluster: true } },
      position: true,
      user_type: true,
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
    },
  });
}

const ADMIN_USER_TYPES = ['Administrator', 'Super Admin'];

export async function createUser(data: CreateUserInput) {
  const { password, ...profileData } = data;

  const userType = await prisma.userType.findUnique({
    where: { id: profileData.user_type_id },
    select: { name: true },
  });
  const is_profile_complete = ADMIN_USER_TYPES.includes(userType?.name ?? '');

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
    throw err;
  }
}

export async function updateUser(id: string, data: UpdateUserInput) {
  const user = await prisma.user.update({
    where: { id },
    data,
  });
  revalidatePath('/users');
  return user;
}

export async function toggleUserStatus(id: string, current: boolean) {
  const user = await prisma.user.update({
    where: { id },
    data: { is_active: !current },
  });
  revalidatePath('/users');
  return user;
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
  }
) {
  let positionId = data.position_id;

  if (data.custom_position_name) {
    const position = await prisma.position.upsert({
      where: { name: data.custom_position_name },
      update: {},
      create: { name: data.custom_position_name },
    });
    positionId = position.id;
  }

  const { position_id: _, custom_position_name: __, ...rest } = data;

  const user = await prisma.user.update({
    where: { id },
    data: { ...rest, position_id: positionId, is_profile_complete: true },
    include: {
      cluster: true,
      unit: { include: { cluster: true } },
      position: true,
      user_type: true,
    },
  });
  revalidatePath('/');
  return user;
}

export async function deleteUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { auth_id: true } });
  if (!user) throw new Error('User not found');

  // Nullify user_id on any reports before deleting to avoid FK constraint violation
  await prisma.report.updateMany({ where: { user_id: id }, data: { user_id: null } });

  await prisma.user.delete({ where: { id } });

  if (user.auth_id) {
    await supabaseAdmin.auth.admin.deleteUser(user.auth_id);
  }

  revalidatePath('/users');
}
