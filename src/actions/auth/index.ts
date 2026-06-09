'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentAuthUser } from '@/lib/server-auth';

const DEFAULT_GOOGLE_EMAIL_DOMAINS = ['up.edu.ph', 'upm.edu.ph', 'post.upm.edu.ph'];

function getAllowedGoogleEmailDomains() {
  const raw = process.env.ALLOWED_GOOGLE_EMAIL_DOMAINS;
  if (!raw) return DEFAULT_GOOGLE_EMAIL_DOMAINS;
  if (raw.trim() === '*') return ['*'];
  return raw
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

function assertAllowedGoogleEmail(email: string) {
  const allowedDomains = getAllowedGoogleEmailDomains();
  if (allowedDomains.includes('*')) return;

  const domain = email.split('@').at(1)?.toLowerCase();
  if (!domain || !allowedDomains.includes(domain)) {
    throw new Error('Google sign-in is restricted to approved email domains.');
  }
}

export async function provisionGoogleUser(
  authId: string,
  email: string,
  fullName: string | null
): Promise<{ userTypeName: string }> {
  const authUser = await getCurrentAuthUser();
  const verifiedEmail = authUser.email;

  if (
    authUser.id !== authId ||
    !verifiedEmail ||
    verifiedEmail.toLowerCase() !== email.toLowerCase()
  ) {
    throw new Error('Unauthorized');
  }

  assertAllowedGoogleEmail(verifiedEmail);

  const existing = await prisma.user.findUnique({
    where: { auth_id: authId },
    include: { user_type: true },
  });
  if (existing) return { userTypeName: existing.user_type.name };

  const ertType = await prisma.userType.findFirst({ where: { name: 'ERT Member' } });
  if (!ertType) throw new Error('ERT Member user type not found in the database.');

  const parts = (fullName ?? '').trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';

  const localPart = verifiedEmail
    .split('@')[0]
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
  const suffix = authId.replace(/-/g, '').slice(0, 6);
  const username = `${localPart}-${suffix}`;

  try {
    const newUser = await prisma.user.create({
      data: {
        auth_id: authId,
        email: verifiedEmail,
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
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in (err as Record<string, unknown>) &&
      (err as Record<string, unknown>).code === 'P2002'
    ) {
      const byEmail = await prisma.user.findFirst({
        where: { email: verifiedEmail },
        include: { user_type: true },
      });
      if (byEmail) return { userTypeName: byEmail.user_type.name };
    }
    throw err;
  }
}
