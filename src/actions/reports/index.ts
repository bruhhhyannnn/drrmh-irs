'use server';

import {
  CasualtyFormData,
  casualtySchema,
  MissingPersonFormData,
  REPORT_PHOTO_FIELD,
  ReportFormData,
  reportSchema,
} from '@/lib';
import { inScope } from '@/lib/admin-scope';
import { unitIdForName } from '@/lib/lookup-names';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import {
  removeReportPhotos,
  reportPhotoPaths,
  signReportPhotos,
  uploadReportPhotos,
} from '@/lib/report-photos';
import { requireAdmin } from '@/lib/server-auth';
import {
  groupReportPhotos,
  mapPopulationCountsToLegacyColumns,
  totalPopulationCount,
} from '@/lib/utils';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

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

/** The unit a report is for: the one picked, or the one typed under "Other (please specify)". */
async function reportUnitId(clusterId: string, unitId?: string | null, unitName?: string | null) {
  const name = unitName?.trim();
  return name ? unitIdForName(clusterId, name) : unitId || null;
}

/**
 * When a report was sent: `sent_at` (ms) from the offline queue, so a report saved offline keeps
 * the time it was sent on the phone. Never later than now; unset means now.
 */
function sentAt(sent_at?: number) {
  return Number.isFinite(sent_at) ? new Date(Math.min(sent_at!, Date.now())) : undefined;
}

/** The files sent under `REPORT_PHOTO_FIELD` (see `toReportPhotoFormData`). */
const photoFiles = (photos?: FormData) =>
  (photos?.getAll(REPORT_PHOTO_FIELD) ?? []).filter(
    (entry): entry is File => typeof entry !== 'string'
  );

/**
 * Creates a report with its people and headcount in one write. `photos` carries the damage and
 * casualty photos, named by `reportPhotoFiles`. They are uploaded first so the rows can hold
 * their paths; if the report then fails to save, the uploads are removed again.
 */
export async function createReport(
  data: ReportFormData & { user_id?: string; sent_at?: number },
  photos?: FormData
) {
  const {
    report_missing_persons,
    report_casualties = [],
    population_counts,
    user_id,
    unit_name,
    sent_at,
    ...reportData
  } = data;

  const id = randomUUID();
  const grouped = groupReportPhotos(photoFiles(photos), report_casualties.length);
  const [damagePhotoPaths, ...casualtyPhotoPaths] = await Promise.all(
    [grouped.damage, ...grouped.casualties].map((files) => uploadReportPhotos(id, files))
  );

  try {
    const report = await prisma.report.create({
      data: {
        ...reportData,
        id,
        ...mapPopulationCountsToLegacyColumns(population_counts),
        submitted_at: sentAt(sent_at),
        user_id: user_id ?? null,
        unit_id: await reportUnitId(reportData.cluster_id, reportData.unit_id, unit_name),
        latitude: reportData.latitude ?? null,
        longitude: reportData.longitude ?? null,
        location_name: reportData.location_name ?? null,
        damage_condition_id: reportData.damage_condition_id || null,
        damage_photo_paths: damagePhotoPaths,
        missing_persons: {
          create: report_missing_persons ?? [],
        },
        casualties: {
          create: report_casualties.map((casualty, i) => ({
            ...casualty,
            photo_paths: casualtyPhotoPaths[i],
          })),
        },
        population_counts: {
          create: population_counts.map(({ category_id, count }) => ({ category_id, count })),
        },
      },
    });

    revalidatePath('/reports');
    return serializeReport(report);
  } catch (err) {
    await removeReportPhotos([damagePhotoPaths, ...casualtyPhotoPaths].flat());
    throw toFriendlyError(err, 'report');
  }
}

const reportEditSchema = reportSchema.omit({ event_id: true }).extend({
  // A casualty already on the report sends its id, so its photos stay with it.
  report_casualties: z
    .array(casualtySchema.extend({ id: z.string().uuid().optional() }))
    .default([]),
});
export type ReportEditData = z.input<typeof reportEditSchema>;

/**
 * Edit report: where, headcount, people and damage in one write, so a failure leaves the
 * report as it was. People and headcount rows are replaced, not merged; a casualty that keeps
 * its id keeps its photos, and the photos of casualties taken off are deleted.
 */
export async function saveReportEdits(id: string, data: ReportEditData) {
  const parsed = reportEditSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'This report is incomplete.');
  }
  const { population_counts, report_missing_persons, report_casualties, ...fields } = parsed.data;
  const before = await prisma.reportCasualty.findMany({
    where: { report_id: id },
    select: { id: true, photo_paths: true },
  });
  // Each id takes its photos once; whatever is left over belongs to casualties taken off.
  const photosById = new Map(before.map((c) => [c.id, c.photo_paths]));
  const casualties = report_casualties.map(({ id: casualtyId, ...casualty }) => {
    const photo_paths = (casualtyId && photosById.get(casualtyId)) || [];
    if (casualtyId) photosById.delete(casualtyId);
    return { ...casualty, photo_paths };
  });

  try {
    const report = await prisma.report.update({
      where: { id },
      data: {
        cluster_id: fields.cluster_id,
        unit_id: await reportUnitId(fields.cluster_id, fields.unit_id, fields.unit_name),
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
        casualties: { deleteMany: {}, create: casualties },
      },
    });
    await removeReportPhotos([...photosById.values()].flat());
    revalidatePath('/reports');
    return serializeReport(report);
  } catch (err) {
    throw toFriendlyError(err, 'report');
  }
}

/** Deletes the report (people and headcount cascade), then its photos. */
export async function deleteReport(id: string) {
  try {
    const photoPaths = await reportPhotoPaths({ id });
    await prisma.report.delete({ where: { id } });
    await removeReportPhotos(photoPaths);
    revalidatePath('/reports');
  } catch (err) {
    throw toFriendlyError(err, 'report');
  }
}

export type ReportPhotoUrls =
  | {
      ok: true;
      damage: string[];
      casualties: { id: string; name: string; condition: string | null; urls: string[] }[];
    }
  | { ok: false; error: string };

/**
 * Short-lived signed URLs for a report's damage and casualty photos. Admins only, and only for
 * a report on a campus they may see: casualty photos are health information.
 */
export async function getReportPhotoUrls(
  token: string | null,
  reportId: string
): Promise<ReportPhotoUrls> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return { ok: false, error: 'Only admins can see report photos.' };

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      damage_photo_paths: true,
      cluster: { select: { campus_id: true } },
      casualties: {
        where: { photo_paths: { isEmpty: false } },
        select: { id: true, name: true, photo_paths: true, condition: { select: { name: true } } },
        orderBy: { created_at: 'asc' },
      },
    },
  });
  if (!report || !inScope(caller.scope, report.cluster.campus_id)) {
    return { ok: false, error: 'This report could not be found.' };
  }

  try {
    const urls = await signReportPhotos([
      ...report.damage_photo_paths,
      ...report.casualties.flatMap((c) => c.photo_paths),
    ]);
    const signed = (paths: string[]) => paths.flatMap((path) => urls.get(path) ?? []);
    return {
      ok: true,
      damage: signed(report.damage_photo_paths),
      casualties: report.casualties.map((c) => ({
        id: c.id,
        name: c.name,
        condition: c.condition?.name ?? null,
        urls: signed(c.photo_paths),
      })),
    };
  } catch {
    return { ok: false, error: 'The photos could not be loaded. Try again in a moment.' };
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

/** Adds a casualty to a submitted report, with up to 3 photos under `REPORT_PHOTO_FIELD`. */
export async function createReportCasualty(
  data: CasualtyFormData & { report_id: string },
  photos?: FormData
) {
  const photoPaths = await uploadReportPhotos(data.report_id, photoFiles(photos));
  try {
    const result = await prisma.reportCasualty.create({
      data: { ...data, photo_paths: photoPaths },
    });
    revalidatePath('/reports');
    return result;
  } catch (err) {
    await removeReportPhotos(photoPaths);
    throw toFriendlyError(err, 'casualty');
  }
}

export async function deleteReportCasualty(id: string) {
  const casualty = await prisma.reportCasualty.delete({
    where: { id },
    select: { photo_paths: true },
  });
  await removeReportPhotos(casualty.photo_paths);
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
