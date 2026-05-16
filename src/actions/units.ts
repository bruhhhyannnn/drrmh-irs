'use server';

import { prisma } from '@/lib/prisma';

export async function getUnits(clusterId?: string) {
  return prisma.unit.findMany({
    where: clusterId ? { cluster_id: clusterId } : undefined,
    include: { cluster: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
}
