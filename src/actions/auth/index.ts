'use server';

import { prisma } from '@/lib/prisma';

export async function provisionGoogleUser(
  authId: string,
  email: string,
  fullName: string | null
): Promise<{ userTypeName: string }> {
  // Return early if user already exists (idempotent — handles returning users)
  const existing = await prisma.user.findUnique({
    where: { auth_id: authId },
    include: { user_type: true },
  });
  if (existing) return { userTypeName: existing.user_type.name };

  // Resolve ERT Member user type
  const ertType = await prisma.userType.findFirst({ where: { name: 'ERT Member' } });
  if (!ertType) throw new Error('ERT Member user type not found in the database.');

  // Parse first/last name from Google's full_name (e.g. "Juan Dela Cruz")
  const parts = (fullName ?? '').trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';

  // Derive a unique username: email local-part + first 6 hex chars of the auth UUID
  const localPart = email
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  const suffix = authId.replace(/-/g, '').slice(0, 6);
  const username = `${localPart}-${suffix}`;

  try {
    const newUser = await prisma.user.create({
      data: {
        auth_id: authId,
        email,
        username,
        first_name: firstName,
        last_name: lastName,
        user_type_id: ertType.id,
        is_active: true,
      },
      include: { user_type: true },
    });
    return { userTypeName: newUser.user_type.name };
  } catch (err: unknown) {
    // P2002 = unique constraint violation — email already belongs to a password-based account
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in (err as unknown as Record<string, unknown>) &&
      (err as unknown as Record<string, unknown>).code === 'P2002'
    ) {
      const byEmail = await prisma.user.findFirst({
        where: { email },
        include: { user_type: true },
      });
      if (byEmail) return { userTypeName: byEmail.user_type.name };
    }
    throw err;
  }
}
