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
import { checkReportCaller, type ReportRefusal } from '@/lib/report-caller';
import {
  removeReportPhotos,
  REPORT_PHOTO_SELECT,
  reportPhotoPaths,
  signReportPhotos,
  uploadReportPhotos,
} from '@/lib/report-photos';
import { requireAdmin, requireProfile } from '@/lib/server-auth';
import {
  groupReportPhotos,
  mapPopulationCountsToLegacyColumns,
  totalPopulationCount,
} from '@/lib/utils';
import { Prisma } from '@prisma/client';
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

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const countPhotos = (paths: string[][]) => paths.reduce((sum, p) => sum + p.length, 0);

export type CreateReportResult = { ok: true; id: string; photoCount: number } | ReportRefusal;

/**
 * Creates a report with its people and headcount in one write, as the caller (`token`): the
 * payload's `user_id` only says whose it is, and another account's answers `retry` (a shared
 * phone). `id` is made once on the phone and kept by the offline queue, so a replay of the
 * caller's own report that already landed is a no-op (an id that is someone else's report is
 * refused); older queued entries have none and get a new one.
 * `photos` carries the damage and casualty photos, named by `reportPhotoFiles`. They are
 * uploaded first so the rows can hold their paths, and removed again only if the row wasn't
 * created. `photoCount` is how many were saved.
 */
export async function createReport(
  token: string | null,
  data: ReportFormData & { id?: string; user_id?: string; sent_at?: number },
  photos?: FormData
): Promise<CreateReportResult> {
  const {
    id: clientId,
    report_missing_persons,
    report_casualties = [],
    population_counts,
    user_id,
    unit_name,
    sent_at,
    ...reportData
  } = data;

  const verified = await requireProfile(token);
  const caller = checkReportCaller(verified, {
    user_id: user_id ?? (verified.ok ? verified.profile.id : null),
    campus_id: null,
  });
  if (!caller.ok) return caller;
  if (clientId !== undefined && !z.string().uuid().safeParse(clientId).success) {
    return { ok: false, error: 'This report has an invalid id.', retry: false };
  }

  const id = clientId ?? randomUUID();
  const profileId = caller.profile.id;
  // A report already saved under this id: the caller's own is a replay and counts as saved;
  // anyone else's is refused without saying anything about it. Null when there is none.
  const replayOf = async (): Promise<CreateReportResult | null> => {
    const row = await prisma.report.findUnique({
      where: { id },
      select: { user_id: true, ...REPORT_PHOTO_SELECT },
    });
    if (!row) return null;
    if (row.user_id !== profileId) {
      return { ok: false, error: 'This report could not be saved.', retry: false };
    }
    return { ok: true, id, photoCount: reportPhotoPaths([row]).length };
  };

  const uploaded: string[] = [];
  let created = false;
  try {
    const already = await replayOf();
    if (already) return already;

    const grouped = groupReportPhotos(photoFiles(photos), report_casualties.length);
    const [damagePhotoPaths, ...casualtyPhotoPaths] = await Promise.all(
      [grouped.damage, ...grouped.casualties].map(async (files) => {
        const paths = await uploadReportPhotos(id, files);
        uploaded.push(...paths);
        return paths;
      })
    );

    await prisma.report.create({
      data: {
        ...reportData,
        id,
        ...mapPopulationCountsToLegacyColumns(population_counts),
        submitted_at: sentAt(sent_at),
        user_id: caller.profile.id,
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
      select: { id: true },
    });
    created = true;

    revalidatePath('/reports');
    return { ok: true, id, photoCount: countPhotos([damagePhotoPaths, ...casualtyPhotoPaths]) };
  } catch (err) {
    // The saved row points at these photos; only a report that wasn't created gives them up.
    if (!created) await removeReportPhotos(uploaded);
    // A replay of the same report that landed in between: it's already saved.
    if (!created && isUniqueViolation(err)) {
      const existing = await replayOf();
      if (existing) return existing;
    }
    throw toFriendlyError(err, 'report');
  }
}

const reportEditSchema = reportSchema.omit({ event_id: true }).extend({
  // A casualty already on the report sends its id, so it keeps its row and photos.
  report_casualties: z
    .array(casualtySchema.extend({ id: z.string().uuid().optional() }))
    .default([]),
  // The casualties the form loaded and took off. Only these go, so one added since the form
  // opened stays.
  removed_casualty_ids: z.array(z.string().uuid()).default([]),
});
export type ReportEditData = z.input<typeof reportEditSchema>;

/** Locks the report rows so a casualty can't be added to them until the transaction ends. */
const lockReport = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT id FROM reports WHERE id = ${id}::uuid FOR UPDATE`;

/**
 * Edit report: where, headcount, people and damage in one write, so a failure leaves the
 * report as it was. Headcount and missing persons are replaced; casualties that keep their id
 * are updated in place, new ones added, and only `removed_casualty_ids` are deleted, with their
 * photos once the write has committed.
 */
export async function saveReportEdits(id: string, data: ReportEditData) {
  const parsed = reportEditSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'This report is incomplete.');
  }
  const {
    population_counts,
    report_missing_persons,
    report_casualties,
    removed_casualty_ids,
    ...fields
  } = parsed.data;
  const removed = { report_id: id, id: { in: removed_casualty_ids } };

  try {
    const unitId = await reportUnitId(fields.cluster_id, fields.unit_id, fields.unit_name);
    const { report, photoPaths } = await prisma.$transaction(async (tx) => {
      await lockReport(tx, id);
      const gone = await tx.reportCasualty.findMany({
        where: removed,
        select: { photo_paths: true },
      });
      const report = await tx.report.update({
        where: { id },
        data: {
          cluster_id: fields.cluster_id,
          unit_id: unitId,
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
          casualties: {
            deleteMany: removed,
            updateMany: report_casualties.flatMap(({ id: casualtyId, ...casualty }) =>
              casualtyId ? [{ where: { id: casualtyId }, data: casualty }] : []
            ),
            create: report_casualties.filter((c) => !c.id),
          },
        },
      });
      return { report, photoPaths: gone.flatMap((c) => c.photo_paths) };
    });
    await removeReportPhotos(photoPaths);
    revalidatePath('/reports');
    return serializeReport(report);
  } catch (err) {
    throw toFriendlyError(err, 'report');
  }
}

/** Deletes the report (people and headcount cascade), then its photos. */
export async function deleteReport(id: string) {
  try {
    const photoPaths = await prisma.$transaction(async (tx) => {
      await lockReport(tx, id);
      const report = await tx.report.findUnique({ where: { id }, select: REPORT_PHOTO_SELECT });
      await tx.report.delete({ where: { id } });
      return report ? reportPhotoPaths([report]) : [];
    });
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
  | ReportRefusal;

/**
 * Short-lived signed URLs for a report's damage and casualty photos. Admins only, and only for
 * a report on a campus they may see: casualty photos are health information.
 */
export async function getReportPhotoUrls(
  token: string | null,
  reportId: string
): Promise<ReportPhotoUrls> {
  try {
    const caller = await requireAdmin(token);
    // Signed out covers an expiring token too: asking again may well work.
    if (!caller.ok) return { ok: false, error: 'Only admins can see report photos.', retry: true };

    const report = await prisma.report.findUnique({
      where: { id: reportId },
      select: {
        damage_photo_paths: true,
        cluster: { select: { campus_id: true } },
        casualties: {
          where: { photo_paths: { isEmpty: false } },
          select: {
            id: true,
            name: true,
            photo_paths: true,
            condition: { select: { name: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!report || !inScope(caller.scope, report.cluster.campus_id)) {
      return { ok: false, error: 'This report could not be found.', retry: false };
    }

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
    return {
      ok: false,
      error: 'The photos could not be loaded. Try again in a moment.',
      retry: true,
    };
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

/** The report's owner and campus, for `checkReportCaller`; null when it is gone. */
async function reportOwner(reportId: string) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: { user_id: true, cluster: { select: { campus_id: true } } },
  });
  return report && { user_id: report.user_id, campus_id: report.cluster.campus_id };
}

export type CreateReportCasualtyResult =
  { ok: true; id: string; photoCount: number } | ReportRefusal;

/**
 * Adds a casualty to a submitted report, with up to 3 photos under `REPORT_PHOTO_FIELD`. Only
 * the report's owner or an in-scope admin may. `photoCount` is how many photos were saved.
 */
export async function createReportCasualty(
  token: string | null,
  data: CasualtyFormData & { report_id: string },
  photos?: FormData
): Promise<CreateReportCasualtyResult> {
  const caller = checkReportCaller(await requireProfile(token), await reportOwner(data.report_id));
  if (!caller.ok) return caller;
  const parsed = casualtySchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Check the casualty.',
      retry: false,
    };
  }

  const photoPaths = await uploadReportPhotos(data.report_id, photoFiles(photos));
  try {
    const result = await prisma.reportCasualty.create({
      data: { ...parsed.data, report_id: data.report_id, photo_paths: photoPaths },
      select: { id: true },
    });
    revalidatePath('/reports');
    return { ok: true, id: result.id, photoCount: photoPaths.length };
  } catch (err) {
    await removeReportPhotos(photoPaths);
    throw toFriendlyError(err, 'casualty');
  }
}

/** Removes a casualty and its photos. Only the report's owner or an in-scope admin may. */
export async function deleteReportCasualty(
  token: string | null,
  id: string
): Promise<{ ok: true } | ReportRefusal> {
  const casualty = await prisma.reportCasualty.findUnique({
    where: { id },
    select: { report_id: true },
  });
  const owner = casualty?.report_id ? await reportOwner(casualty.report_id) : null;
  const caller = checkReportCaller(await requireProfile(token), owner);
  if (!caller.ok) return caller;

  const { photo_paths } = await prisma.reportCasualty.delete({
    where: { id },
    select: { photo_paths: true },
  });
  await removeReportPhotos(photo_paths);
  revalidatePath('/reports');
  return { ok: true };
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
