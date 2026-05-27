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
    include: { unit: { include: { cluster: true } }, position: true, user_type: true },
    orderBy: { created_at: 'desc' },
  });
}

export async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { unit: { include: { cluster: true } }, position: true, user_type: true },
  });
}

export async function getUserByAuthId(authId: string) {
  return prisma.user.findUnique({
    where: { auth_id: authId },
    include: { unit: { include: { cluster: true } }, position: true, user_type: true },
  });
}

export async function createUser(data: CreateUserInput) {
  const { password, ...profileData } = data;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: profileData.email,
    password,
    email_confirm: true, // skip confirmation email, admin is creating the account
  });

  if (authError) throw new Error(authError.message);

  const auth_id = authData.user.id;

  try {
    const user = await prisma.user.create({ data: { ...profileData, auth_id } });
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
