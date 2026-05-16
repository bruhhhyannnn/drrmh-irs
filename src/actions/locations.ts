'use server';

import { prisma } from '@/lib/prisma';

export async function getLocations(clusterId?: string) {
  return prisma.location.findMany({
    where: clusterId ? { cluster_id: clusterId } : undefined,
    include: { cluster: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
}
