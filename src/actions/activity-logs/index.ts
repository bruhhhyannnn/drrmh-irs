'use server';

import { prisma } from '@/lib/prisma';

const PER_PAGE = 10;

export async function getActivityLogs(page: number = 1, query?: string) {
  const where = query
    ? {
        OR: [
          { module: { contains: query, mode: 'insensitive' as const } },
          { action: { contains: query, mode: 'insensitive' as const } },
          { doc_name: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const [data, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { data, total };
}
