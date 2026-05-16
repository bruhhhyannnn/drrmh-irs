'use server';

import { prisma } from '@/lib/prisma';

export async function getPositions() {
  return prisma.position.findMany({ orderBy: { name: 'asc' } });
}
