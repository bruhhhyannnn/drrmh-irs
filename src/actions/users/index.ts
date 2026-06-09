'use server';

import { userCreateSchema, userEditSchema } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import {
  getCurrentAuthUser,
  requireAdmin,
  requireProfileOwnerOrAdmin,
} from '@/lib/server-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

export type CreateUserInput = z.infer<typeof userCreateSchema>;
export type UpdateUserInput = Partial<z.infer<typeof userEditSchema>>;

const userUpdateSchema = userEditSchema.partial();
const completeProfileSchema = z.object({
  position_id: z.string().uuid(),
  first_name: z.string().trim().min(1).max(100).optional(),
  last_name: z.string().trim().min(1).max(100).optional(),
});

const ADMIN_USER_TYPES = ['Administrator', 'Super Admin'];

function normalizeNullableUserFields(data: Record<string, unknown>) {
  const normalized = { ...data };
  for (const key of ['middle_name', 'suffix', 'unit_id', 'position_id'] as const) {
    if (key in normalized && !normalized[key]) {
      normalized[key] = null;
    }
  }
  return normalized;
}

export async function getUsers(query?: string) {
  await requireAdmin();
  const safeQuery = query?.trim().slice(0, 100);

  return prisma.user.findMany({
    where: safeQuery
      ? {
          OR: [
            { first_name: { contains: safeQuery, mode: 'insensitive' } },
            { last_name: { contains: safeQuery, mode: 'insensitive' } },
            { email: { contains: safeQuery, mode: 'insensitive' } },
            { username: { contains: safeQuery, mode: 'insensitive' } },
          ],
        }
      : undefined,
    include: { unit: { include: { cluster: true } }, position: true, user_type: true },
    orderBy: { created_at: 'desc' },
  });
}

export async function getUser(id: string) {
  await requireAdmin();
  return prisma.user.findUnique({
    where: { id },
    include: { unit: { include: { cluster: true } }, position: true, user_type: true },
  });
}

export async function getUserByAuthId(authId: string) {
  const authUser = await getCurrentAuthUser();
  if (authUser.id !== authId) throw new Error('Forbidden');

  return prisma.user.findUnique({
    where: { auth_id: authId },
    include: { unit: { include: { cluster: true } }, position: true, user_type: true },
  });
}

export async function createUser(data: CreateUserInput) {
  await requireAdmin();
  const parsed = userCreateSchema.parse(data);
  const normalized = normalizeNullableUserFields(parsed) as CreateUserInput;
  const { password, ...profileData } = normalized;

  const userType = await prisma.userType.findUnique({
    where: { id: String(profileData.user_type_id) },
    select: { name: true },
  });
  const is_profile_complete = ADMIN_USER_TYPES.includes(userType?.name ?? '');

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: String(profileData.email),
    password,
    email_confirm: true,
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
  const currentUser = await requireAdmin();
  const parsed = userUpdateSchema.parse(data);

  if (id === currentUser.id && ('is_active' in parsed || 'user_type_id' in parsed)) {
    throw new Error('You cannot change your own status or role.');
  }

  const user = await prisma.user.update({
    where: { id },
    data: normalizeNullableUserFields(parsed) as UpdateUserInput,
  });
  revalidatePath('/users');
  return user;
}

export async function toggleUserStatus(id: string, current: boolean) {
  const currentUser = await requireAdmin();
  if (id === currentUser.id) throw new Error('You cannot deactivate your own account.');

  const user = await prisma.user.update({
    where: { id },
    data: { is_active: !current },
  });
  revalidatePath('/users');
  return user;
}

export async function completeUserProfile(
  id: string,
  data: { position_id: string; first_name?: string; last_name?: string }
) {
  await requireProfileOwnerOrAdmin(id);
  const parsed = completeProfileSchema.parse(data);

  const user = await prisma.user.update({
    where: { id },
    data: { ...parsed, is_profile_complete: true },
    include: { unit: { include: { cluster: true } }, position: true, user_type: true },
  });
  revalidatePath('/');
  return user;
}

export async function deleteUser(id: string) {
  const currentUser = await requireAdmin();
  if (id === currentUser.id) throw new Error('You cannot delete your own account.');

  const user = await prisma.user.findUnique({ where: { id }, select: { auth_id: true } });
  if (!user) throw new Error('User not found');

  await prisma.user.delete({ where: { id } });

  if (user.auth_id) {
    await supabaseAdmin.auth.admin.deleteUser(user.auth_id);
  }

  revalidatePath('/users');
}
