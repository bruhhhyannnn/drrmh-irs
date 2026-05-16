'use server';

import { prisma } from '@/lib/prisma';

export async function getUserTypes() {
  return prisma.userType.findMany({ orderBy: { name: 'asc' } });
}
