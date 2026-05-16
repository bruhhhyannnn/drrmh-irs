'use server';

import { prisma } from '@/lib/prisma';

export async function getClusters() {
  return prisma.cluster.findMany({ orderBy: { name: 'asc' } });
}
