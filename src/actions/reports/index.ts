'use server';

import { CasualtyFormData, MissingPersonFormData, ReportFormData } from '@/lib';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const PER_PAGE = 10;

export async function getReports(page: number = 1, query?: string) {
  const where: Prisma.ReportWhereInput = {
    ...(query && {
      OR: [
        { cluster: { name: { contains: query, mode: 'insensitive' } } },
        { unit: { name: { contains: query, mode: 'insensitive' } } },
        { event: { name: { contains: query, mode: 'insensitive' } } },
      ],
    }),
  };

  const [data, total] = await Promise.all([
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
        _count: { select: { casualties: true, missing_persons: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.report.count({ where }),
  ]);

  return { data, total };
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
      damage_conditions: {
        select: { name: true },
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
      damage_conditions: {
        select: { name: true },
      },
    },
  });
}

export async function createReport(data: ReportFormData) {
  const { report_missing_persons, report_casualties, ...reportData } = data;

  const report = await prisma.report.create({
    data: {
      ...reportData,
      unit_id: reportData.unit_id || null,
      location_id: reportData.location_id || null,
      damage_condition_id: reportData.damage_condition_id || null,
      missing_persons: {
        create: report_missing_persons ?? [],
      },
      casualties: {
        create: report_casualties ?? [],
      },
    },
  });

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
    prisma.report.findMany({
      select: {
        cluster_id: true,
        _count: { select: { casualties: true, missing_persons: true } },
      },
    }),
    prisma.cluster.findMany({ select: { id: true, name: true } }),
  ]);

  const nameMap = Object.fromEntries(clusters.map((c) => [c.id, c.name]));

  const grouped: Record<string, { reports: number; casualties: number; missing: number }> = {};
  for (const r of rows) {
    const entry = grouped[r.cluster_id] ?? { reports: 0, casualties: 0, missing: 0 };
    entry.reports += 1;
    entry.casualties += r._count.casualties;
    entry.missing += r._count.missing_persons;
    grouped[r.cluster_id] = entry;
  }

  return Object.entries(grouped).map(([id, counts]) => ({
    cluster: nameMap[id] ?? 'Unknown',
    ...counts,
  }));
}

export async function getReportTotals() {
  const [reports, casualties, missing] = await Promise.all([
    prisma.report.count(),
    prisma.reportCasualty.count(),
    prisma.reportMissingPerson.count(),
  ]);

  return { reports, casualties, missing };
}

// Report Casualties
export async function getReportCasualties(reportId: string) {
  return prisma.reportCasualty.findMany({
    where: { report_id: reportId },
    include: { condition: { select: { name: true } } },
    orderBy: { condition: { name: 'asc' } },
  });
}

export async function createReportCasualty(data: CasualtyFormData & { report_id: string }) {
  const result = await prisma.reportCasualty.create({ data });
  revalidatePath('/reports');
  return result;
}

export async function deleteReportCasualty(id: string) {
  await prisma.reportCasualty.delete({ where: { id } });
  revalidatePath('/reports');
}

// Report Missing Persons
export async function getReportMissingPersons(reportId: string) {
  return prisma.reportMissingPerson.findMany({
    where: { report_id: reportId },
    orderBy: { created_at: 'asc' },
  });
}

export async function createReportMissingPerson(
  data: MissingPersonFormData & { report_id: string }
) {
  const result = await prisma.reportMissingPerson.create({ data });
  revalidatePath('/reports');
  return result;
}

export async function deleteReportMissingPerson(id: string) {
  await prisma.reportMissingPerson.delete({ where: { id } });
  revalidatePath('/reports');
}
