'use server';

import { CasualtyFormData, MissingPersonFormData, ReportFormData, reportSchema } from '@/lib';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { mapPopulationCountsToLegacyColumns, totalPopulationCount } from '@/lib/utils';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';

const PER_PAGE = 10;

function serializeReport<T extends { latitude: unknown; longitude: unknown }>(r: T) {
  return {
    ...r,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
  };
}

export type ReportListFilters = { eventId?: string; clusterId?: string };

export async function getReports(
  page: number = 1,
  query?: string,
  campusId?: string,
  filters: ReportListFilters = {}
) {
  const where: Prisma.ReportWhereInput = {
    ...(query && {
      OR: [
        { user: { first_name: { contains: query, mode: 'insensitive' } } },
        { user: { last_name: { contains: query, mode: 'insensitive' } } },
        { cluster: { name: { contains: query, mode: 'insensitive' } } },
        { unit: { name: { contains: query, mode: 'insensitive' } } },
        { event: { name: { contains: query, mode: 'insensitive' } } },
      ],
    }),
    ...(campusId && { cluster: { campus_id: campusId } }),
    ...(filters.eventId && { event_id: filters.eventId }),
    ...(filters.clusterId && { cluster_id: filters.clusterId }),
  };

  const [data, total] = await Promise.all([
    prisma.report.findMany({
      where,
      include: {
        event: { include: { campus: { select: { name: true } } } },
        user: {
          select: {
            first_name: true,
            last_name: true,
            position: { select: { name: true } },
          },
        },
        cluster: { select: { name: true } },
        unit: { select: { name: true } },
        population_counts: { select: { count: true } },
        _count: { select: { casualties: true, missing_persons: true } },
      },
      orderBy: { submitted_at: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.report.count({ where }),
  ]);

  return { data: data.map(serializeReport), total, perPage: PER_PAGE };
}

export async function getReport(id: string) {
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      event: { include: { campus: { select: { name: true } } } },
      user: {
        select: {
          first_name: true,
          last_name: true,
          email: true,
          position: { select: { name: true } },
        },
      },
      cluster: { select: { name: true, campus_id: true } },
      unit: { select: { name: true } },
      missing_persons: { select: { id: true, name: true, age: true, sex: true } },
      casualties: {
        include: { condition: { select: { name: true } } },
      },
      damage_conditions: {
        select: { name: true },
      },
      population_counts: {
        include: { category: { select: { id: true, code: true, name: true } } },
      },
    },
  });
  if (!report) return null;
  return serializeReport(report);
}

export async function createReport(data: ReportFormData & { user_id?: string }) {
  const { report_missing_persons, report_casualties, population_counts, user_id, ...reportData } =
    data;

  try {
    const report = await prisma.report.create({
      data: {
        ...reportData,
        ...mapPopulationCountsToLegacyColumns(population_counts),
        user_id: user_id ?? null,
        unit_id: reportData.unit_id || null,
        latitude: reportData.latitude ?? null,
        longitude: reportData.longitude ?? null,
        location_name: reportData.location_name ?? null,
        damage_condition_id: reportData.damage_condition_id || null,
        missing_persons: {
          create: report_missing_persons ?? [],
        },
        casualties: {
          create: report_casualties ?? [],
        },
        population_counts: {
          create: population_counts.map(({ category_id, count }) => ({ category_id, count })),
        },
      },
    });

    revalidatePath('/reports');
    return serializeReport(report);
  } catch (err) {
    throw toFriendlyError(err, 'report');
  }
}

const reportEditSchema = reportSchema.omit({ event_id: true });
export type ReportEditData = z.input<typeof reportEditSchema>;

/**
 * Edit report: where, headcount, people and damage in one write, so a failure leaves the
 * report as it was. People and headcount rows are replaced, not merged.
 */
export async function saveReportEdits(id: string, data: ReportEditData) {
  const parsed = reportEditSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'This report is incomplete.');
  }
  const { population_counts, report_missing_persons, report_casualties, ...fields } = parsed.data;
  try {
    const report = await prisma.report.update({
      where: { id },
      data: {
        cluster_id: fields.cluster_id,
        unit_id: fields.unit_id || null,
        damage_condition_id: fields.damage_condition_id || null,
        latitude: fields.latitude ?? null,
        longitude: fields.longitude ?? null,
        location_name: fields.location_name ?? null,
        ...mapPopulationCountsToLegacyColumns(population_counts),
        population_counts: {
          deleteMany: {},
          create: population_counts.map(({ category_id, count }) => ({ category_id, count })),
        },
        missing_persons: { deleteMany: {}, create: report_missing_persons },
        casualties: { deleteMany: {}, create: report_casualties },
      },
    });
    revalidatePath('/reports');
    return serializeReport(report);
  } catch (err) {
    throw toFriendlyError(err, 'report');
  }
}

export async function deleteReport(id: string) {
  try {
    await prisma.report.delete({ where: { id } });
    revalidatePath('/reports');
  } catch (err) {
    throw toFriendlyError(err, 'report');
  }
}

export async function getMyReportForOngoingEvent(userId: string) {
  const statusRow = await prisma.eventStatus.findFirst({
    where: { name: { equals: 'Ongoing', mode: 'insensitive' } },
    select: { id: true },
  });
  if (!statusRow) return null;

  const report = await prisma.report.findFirst({
    where: {
      user_id: userId,
      event: { status_id: statusRow.id },
    },
    include: {
      event: { select: { id: true, name: true } },
      cluster: { select: { name: true } },
      unit: { select: { name: true } },
      _count: { select: { casualties: true, missing_persons: true } },
    },
    orderBy: { created_at: 'desc' },
  });

  if (!report) return null;
  return serializeReport(report);
}

/** The member's most recent report on any event — shown when no event is ongoing. */
export async function getMyLatestReport(userId: string) {
  const report = await prisma.report.findFirst({
    where: { user_id: userId },
    orderBy: { submitted_at: 'desc' },
    select: {
      id: true,
      submitted_at: true,
      event: { select: { name: true } },
      population_counts: { select: { count: true } },
    },
  });
  if (!report) return null;
  return {
    id: report.id,
    eventName: report.event.name,
    submittedAt: report.submitted_at,
    headcount: totalPopulationCount(report.population_counts),
  };
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
