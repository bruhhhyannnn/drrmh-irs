'use server';

import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/server-auth';

const PER_PAGE = 10;

export async function getActivityLogs(page: number = 1, query?: string) {
  await requireAdmin();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeQuery = query?.trim().slice(0, 100);
  const where = safeQuery
    ? {
        OR: [
          { module: { contains: safeQuery, mode: 'insensitive' as const } },
          { action: { contains: safeQuery, mode: 'insensitive' as const } },
          { doc_name: { contains: safeQuery, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const [data, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (safePage - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { data, total };
}
