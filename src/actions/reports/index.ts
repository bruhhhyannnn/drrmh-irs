'use server';

import {
  casualtySchema,
  missingPersonSchema,
  reportSchema,
  type CasualtyFormData,
  type MissingPersonFormData,
  type ReportFormData,
} from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { isAdminProfile, requireAdmin, requireStaff } from '@/lib/server-auth';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const PER_PAGE = 10;

const reportUpdateSchema = reportSchema.omit({
  report_missing_persons: true,
  report_casualties: true,
});

export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;

const casualtyCreateSchema = casualtySchema.extend({ report_id: z.string().uuid() });
const missingPersonCreateSchema = missingPersonSchema.extend({ report_id: z.string().uuid() });

function serializeReport<T extends { latitude: unknown; longitude: unknown }>(r: T) {
  return {
    ...r,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
  };
}

async function requireReportOwnerOrAdmin(reportId: string) {
  const profile = await requireStaff();
  if (isAdminProfile(profile)) return profile;

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { user_id: true },
  });

  if (!report || report.user_id !== profile.id) {
    throw new Error('Forbidden');
  }

  return profile;
}

function normalizeReportData(data: ReportUpdateInput) {
  const parsed = reportUpdateSchema.parse(data);
  return {
    ...parsed,
    unit_id: parsed.unit_id || null,
    latitude: parsed.latitude ?? null,
    longitude: parsed.longitude ?? null,
    location_name: parsed.location_name?.trim() || null,
    damage_condition_id: parsed.damage_condition_id || null,
  };
}

export async function getReports(page: number = 1, query?: string) {
  await requireAdmin();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeQuery = query?.trim().slice(0, 100);
  const where: Prisma.ReportWhereInput = {
    ...(safeQuery && {
      OR: [
        { cluster: { name: { contains: safeQuery, mode: 'insensitive' } } },
        { unit: { name: { contains: safeQuery, mode: 'insensitive' } } },
        { event: { name: { contains: safeQuery, mode: 'insensitive' } } },
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
        _count: { select: { casualties: true, missing_persons: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (safePage - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.report.count({ where }),
  ]);

  return { data: data.map(serializeReport), total };
}

export async function getReport(id: string) {
  await requireReportOwnerOrAdmin(id);

  const report = await prisma.report.findUnique({
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
      missing_persons: { select: { name: true } },
      casualties: {
        include: { condition: { select: { name: true } } },
      },
      damage_conditions: {
        select: { name: true },
      },
    },
  });
  if (!report) return null;
  return serializeReport(report);
}

export async function getReportsByEvent(eventId: string) {
  await requireAdmin();

  const reports = await prisma.report.findMany({
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
      missing_persons: { select: { name: true } },
      casualties: {
        include: { condition: { select: { name: true } } },
      },
      damage_conditions: {
        select: { name: true },
      },
    },
  });
  return reports.map(serializeReport);
}

export async function createReport(data: ReportFormData) {
  const profile = await requireStaff();
  if (!profile.is_profile_complete) {
    throw new Error('Complete your profile before submitting reports.');
  }

  const parsed = reportSchema.parse(data);
  const { report_missing_persons, report_casualties, ...reportData } = parsed;

  const report = await prisma.report.create({
    data: {
      ...reportData,
      user_id: profile.id,
      unit_id: reportData.unit_id || null,
      latitude: reportData.latitude ?? null,
      longitude: reportData.longitude ?? null,
      location_name: reportData.location_name?.trim() || null,
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
  return serializeReport(report);
}

export async function updateReport(id: string, data: ReportUpdateInput) {
  await requireAdmin();
  const report = await prisma.report.update({ where: { id }, data: normalizeReportData(data) });
  revalidatePath('/reports');
  return serializeReport(report);
}

export async function deleteReport(id: string) {
  await requireAdmin();
  await prisma.report.delete({ where: { id } });
  revalidatePath('/reports');
}

export async function getReportClusterSummary() {
  await requireAdmin();

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
  await requireAdmin();

  const [reports, casualties, missing] = await Promise.all([
    prisma.report.count(),
    prisma.reportCasualty.count(),
    prisma.reportMissingPerson.count(),
  ]);

  return { reports, casualties, missing };
}

export async function getReportCasualties(reportId: string) {
  await requireReportOwnerOrAdmin(reportId);

  return prisma.reportCasualty.findMany({
    where: { report_id: reportId },
    include: { condition: { select: { name: true } } },
    orderBy: { condition: { name: 'asc' } },
  });
}

export async function createReportCasualty(data: CasualtyFormData & { report_id: string }) {
  const parsed = casualtyCreateSchema.parse(data);
  await requireReportOwnerOrAdmin(parsed.report_id);

  const result = await prisma.reportCasualty.create({ data: parsed });
  revalidatePath('/reports');
  return result;
}

export async function deleteReportCasualty(id: string) {
  const casualty = await prisma.reportCasualty.findUnique({
    where: { id },
    select: { report_id: true },
  });
  if (!casualty?.report_id) throw new Error('Casualty not found');

  await requireReportOwnerOrAdmin(casualty.report_id);
  await prisma.reportCasualty.delete({ where: { id } });
  revalidatePath('/reports');
}

export async function getReportMissingPersons(reportId: string) {
  await requireReportOwnerOrAdmin(reportId);

  return prisma.reportMissingPerson.findMany({
    where: { report_id: reportId },
    orderBy: { created_at: 'asc' },
  });
}

export async function createReportMissingPerson(
  data: MissingPersonFormData & { report_id: string }
) {
  const parsed = missingPersonCreateSchema.parse(data);
  await requireReportOwnerOrAdmin(parsed.report_id);

  const result = await prisma.reportMissingPerson.create({ data: parsed });
  revalidatePath('/reports');
  return result;
}

export async function deleteReportMissingPerson(id: string) {
  const missingPerson = await prisma.reportMissingPerson.findUnique({
    where: { id },
    select: { report_id: true },
  });
  if (!missingPerson?.report_id) throw new Error('Missing person not found');

  await requireReportOwnerOrAdmin(missingPerson.report_id);
  await prisma.reportMissingPerson.delete({ where: { id } });
  revalidatePath('/reports');
}
