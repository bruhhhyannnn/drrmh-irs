import 'server-only';

import { cookies } from 'next/headers';
import type { Prisma } from '@prisma/client';
import { AUTH_TOKEN_COOKIE } from './auth-cookie';
import { prisma } from './prisma';
import { supabaseAdmin } from './supabase-admin';

const currentUserInclude = {
  unit: { include: { cluster: true } },
  position: true,
  user_type: true,
} satisfies Prisma.UserInclude;

export type CurrentUserProfile = Prisma.UserGetPayload<{ include: typeof currentUserInclude }>;

export const ADMIN_USER_TYPES = ['Administrator', 'Super Admin'] as const;
export const STAFF_USER_TYPES = ['ERT Member', ...ADMIN_USER_TYPES] as const;

function hasUserType(profile: CurrentUserProfile, allowed: readonly string[]) {
  return allowed.includes(profile.user_type.name);
}

export function isAdminProfile(profile: CurrentUserProfile) {
  return hasUserType(profile, ADMIN_USER_TYPES);
}

export async function getCurrentAuthUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error('Unauthorized');
  }

  return data.user;
}

export async function getCurrentUserProfile() {
  const authUser = await getCurrentAuthUser();
  const profile = await prisma.user.findUnique({
    where: { auth_id: authUser.id },
    include: currentUserInclude,
  });

  if (!profile || !profile.is_active) {
    throw new Error('Unauthorized');
  }

  return profile;
}

export async function requireUserTypes(allowed: readonly string[]) {
  const profile = await getCurrentUserProfile();

  if (!hasUserType(profile, allowed)) {
    throw new Error('Forbidden');
  }

  return profile;
}

export function requireAdmin() {
  return requireUserTypes(ADMIN_USER_TYPES);
}

export function requireStaff() {
  return requireUserTypes(STAFF_USER_TYPES);
}

export async function requireProfileOwnerOrAdmin(profileId: string) {
  const profile = await getCurrentUserProfile();

  if (profile.id !== profileId && !isAdminProfile(profile)) {
    throw new Error('Forbidden');
  }

  return profile;
}
