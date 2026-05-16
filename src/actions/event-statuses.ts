'use server';

import { prisma } from '@/lib/prisma';

export async function getEventStatuses() {
  return prisma.eventStatus.findMany({ orderBy: { name: 'asc' } });
}
