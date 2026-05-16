'use server';

import { prisma } from '@/lib/prisma';

export async function getCasualtyConditions() {
  return prisma.casualtyCondition.findMany({ orderBy: { name: 'asc' } });
}
