'use server';

import { prisma } from '@/lib/prisma';

export async function getLandingData() {
  const [events, totalEvents] = await Promise.all([
    prisma.event.findMany({
      select: {
        id: true,
        name: true,
        started_at: true,
        status: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 8,
    }),
    prisma.event.count(),
  ]);

  const activeEvents = events.filter((e) => e.status?.name?.toLowerCase() === 'ongoing').length;

  return { totalEvents, activeEvents, events };
}
