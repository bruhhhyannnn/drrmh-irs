'use server';

import { prisma } from '@/lib/prisma';

export async function getDamageConditions() {
  return prisma.damageCondition.findMany({ orderBy: { name: 'asc' } });
}
