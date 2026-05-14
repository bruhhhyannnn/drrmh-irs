'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';

const PER_PAGE = 10;

export async function getReports(page: number = 1, query?: string, isVerified: boolean = true) {
  const where: Prisma.ReportWhereInput = {
    is_verified: isVerified,
    ...(query && {
      OR: [
        { cluster: { name: { contains: query, mode: 'insensitive' } } },
        { unit: { name: { contains: query, mode: 'insensitive' } } },
        { event: { name: { contains: query, mode: 'insensitive' } } },
      ],
    }),
  };

  const [data, total, unverifiedCount] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        event: true,
        user: {
          select: {
            first_name: true,
            last_name: true,
            position: { select: { name: true } },
          },
        },
        cluster: { select: { name: true } },
        unit: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.report.count({ where }),
    prisma.report.count({ where: { is_verified: false } }),
  ]);

  return { data, total, unverifiedCount };
}

export async function getReport(id: string) {
  return prisma.report.findUnique({
    where: { id },
    include: {
      event: true,
      user: {
        select: {
          first_name: true,
          last_name: true,
          position: { select: { name: true } },
        },
      },
      cluster: { select: { name: true } },
      unit: { select: { name: true } },
      location: { select: { name: true } },
      missing_persons: { select: { name: true } },
      casualties: {
        include: { condition: { select: { name: true } } },
      },
      damages: {
        include: { damage_report: { select: { name: true } } },
      },
    },
  });
}

export async function getReportsByEvent(eventId: string) {
  return prisma.report.findMany({
    where: { event_id: eventId },
    orderBy: { created_at: 'asc' },
    include: {
      user: {
        select: {
          first_name: true,
          last_name: true,
          position: { select: { name: true } },
        },
      },
      cluster: { select: { name: true } },
      unit: { select: { name: true } },
      location: { select: { name: true } },
      missing_persons: { select: { name: true } },
      casualties: {
        include: { condition: { select: { name: true } } },
      },
      damages: {
        include: { damage_report: { select: { name: true } } },
      },
    },
  });
}

export async function createReport(data: Prisma.ReportCreateInput) {
  const report = await prisma.report.create({ data });
  revalidatePath('/reports');
  return report;
}

export async function updateReport(id: string, data: Prisma.ReportUpdateInput) {
  const report = await prisma.report.update({ where: { id }, data });
  revalidatePath('/reports');
  return report;
}

export async function deleteReport(id: string) {
  await prisma.report.delete({ where: { id } });
  revalidatePath('/reports');
}

export async function getReportClusterSummary() {
  const [rows, clusters] = await Promise.all([
    prisma.report.groupBy({
      by: ['cluster_id'],
      _count: { id: true },
      _sum: { casualties_count: true, missing_count: true },
    }),
    prisma.cluster.findMany({ select: { id: true, name: true } }),
  ]);

  const nameMap = Object.fromEntries(clusters.map((c) => [c.id, c.name]));

  return rows.map((r) => ({
    cluster: nameMap[r.cluster_id] ?? 'Unknown',
    reports: r._count.id,
    casualties: r._sum.casualties_count ?? 0,
    missing: r._sum.missing_count ?? 0,
  }));
}

export async function getReportTotals() {
  const result = await prisma.report.aggregate({
    _count: { id: true },
    _sum: { casualties_count: true, missing_count: true },
  });

  return {
    reports: result._count.id,
    casualties: result._sum.casualties_count ?? 0,
    missing: result._sum.missing_count ?? 0,
  };
}

export async function verifyReport(reportId: string, approved: boolean, adminId: string) {
  return prisma.report.update({
    where: { id: reportId },
    data: {
      is_verified: approved,
      verified_by: adminId, // supabase auth uuid matches auth.users.id
    },
  });
}
