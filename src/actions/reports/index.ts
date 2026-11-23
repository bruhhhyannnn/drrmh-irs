'use server';

import {
  CasualtyFormData,
  casualtySchema,
  MissingPersonFormData,
  missingPersonSchema,
  REPORT_PHOTO_FIELD,
  reportCreateSchema,
  ReportFormData,
  reportSchema,
} from '@/lib';
import { inScope } from '@/lib/admin-scope';
import { unitIdForNameIn } from '@/lib/lookup-names';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import {
  checkNewReport,
  checkReportCaller,
  isOngoing,
  reportSaveFailure,
  type ReportRefusal,
} from '@/lib/report-caller';
import { mergePhotoPaths, newPhotoRoom } from '@/lib/report-photo-edits';
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
  isUuid,
  mapPopulationCountsToLegacyColumns,
  totalPopulationCount,
} from '@/lib/utils';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const PER_PAGE = 10;

const REPORT_NOT_FOUND: ReportRefusal = {
  ok: false,
  error: 'This report could not be found.',
  retry: false,
};

function serializeReport<T extends { latitude: unknown; longitude: unknown }>(r: T) {
  return {
    ...r,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
  };
}

export type ReportListFilters = { eventId?: string; clusterId?: string };

const NO_REPORTS = { data: [], total: 0, perPage: PER_PAGE };

/**
 * The Reports list, for admins (#87, #102): an Administrator's own campus whatever is asked, a
 * Super Admin's pick (or all). Empty for anyone else.
 */
export async function getReports(
  token: string | null,
  page: number = 1,
  query?: string,
  campusId?: string,
  filters: ReportListFilters = {}
) {
  const caller = await requireAdmin(token, campusId || null);
  if (!caller.ok) return NO_REPORTS;
  if (
    (filters.eventId && !isUuid(filters.eventId)) ||
    (filters.clusterId && !isUuid(filters.clusterId))
  ) {
    return NO_REPORTS;
  }
  const scopeCampus = caller.scope.campusId;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const search = typeof query === 'string' ? query.slice(0, 200) : undefined;
  const where: Prisma.ReportWhereInput = {
    ...(search && {
      OR: [
        { user: { first_name: { contains: search, mode: 'insensitive' } } },
        { user: { last_name: { contains: search, mode: 'insensitive' } } },
        { cluster: { name: { contains: search, mode: 'insensitive' } } },
        { unit: { name: { contains: search, mode: 'insensitive' } } },
        { event: { name: { contains: search, mode: 'insensitive' } } },
      ],
    }),
    ...(scopeCampus && { cluster: { campus_id: scopeCampus } }),
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
      skip: (safePage - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.report.count({ where }),
  ]);

  return { data: data.map(serializeReport), total, perPage: PER_PAGE };
}

/** A report with its people, headcount and damage. Only its owner or an in-scope admin may. */
export async function getReport(token: string | null, id: string) {
  const caller = await requireProfile(token);
  if (!isUuid(id)) return REPORT_NOT_FOUND;
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
  const check = checkReportCaller(
    caller,
    report && { user_id: report.user_id, campus_id: report.cluster.campus_id }
  );
  if (!check.ok) return check;
  // A missing report is refused above.
  return { ok: true as const, report: serializeReport(report!) };
}

/**
 * The unit a report is for: the one picked, or the one typed under "Other (please specify)".
 * Called inside the report's transaction, so a typed unit is added only if the report is saved
 * (#101).
 */
async function reportUnitIdIn(
  tx: Prisma.TransactionClient,
  clusterId: string,
  unitId?: string | null,
  unitName?: string | null
) {
  const name = unitName?.trim();
  return name ? unitIdForNameIn(tx, clusterId, name) : unitId || null;
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
 * created. `photoCount` is how many were saved. A server fault answers `reportSaveFailure`
 * rather than throwing, so the phone gets a readable message and a queued report stays queued.
 */
export async function createReport(
  token: string | null,
  data: ReportFormData & { id?: string; user_id?: string; sent_at?: number },
  photos?: FormData
): Promise<CreateReportResult> {
  try {
    return await saveNewReport(token, data, photos);
  } catch (err) {
    console.error('createReport failed:', err);
    return reportSaveFailure(err);
  }
}

async function saveNewReport(
  token: string | null,
  data: ReportFormData & { id?: string; user_id?: string; sent_at?: number },
  photos?: FormData
): Promise<CreateReportResult> {
  const raw = (data ?? {}) as { id?: unknown; user_id?: unknown };
  const verified = await requireProfile(token);
  const caller = checkReportCaller(verified, {
    user_id: isUuid(raw.user_id) ? raw.user_id : verified.ok ? verified.profile.id : null,
    campus_id: null,
  });
  if (!caller.ok) return caller;
  if (raw.id !== undefined && !isUuid(raw.id)) {
    return { ok: false, error: 'This report has an invalid id.', retry: false };
  }
  // Parsed before anything else runs (#101): only the report's own fields reach Prisma, nested
  // people keep only theirs, and the lists are capped before photos are sorted by casualty.
  const parsed = reportCreateSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'This report is incomplete.',
      retry: false,
    };
  }
  const {
    id: clientId,
    report_missing_persons,
    report_casualties,
    population_counts,
    user_id: _owner,
    unit_name,
    sent_at,
    ...reportData
  } = parsed.data;

  const id = clientId ?? randomUUID();
  const profileId = caller.profile.id;
  const submittedAt = sentAt(sent_at);
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

    // Where the report goes is checked on the server (#101, #108): the event, the cluster on
    // its campus, the unit in that cluster, and one report per member per event.
    const unitId = unit_name ? null : (reportData.unit_id ?? null);
    const [event, cluster, unit, mine] = await Promise.all([
      prisma.event.findUnique({
        where: { id: reportData.event_id },
        select: { campus_id: true, ended_at: true, status: { select: { name: true } } },
      }),
      prisma.cluster.findUnique({
        where: { id: reportData.cluster_id },
        select: { campus_id: true },
      }),
      unitId
        ? prisma.unit.findUnique({ where: { id: unitId }, select: { cluster_id: true } })
        : undefined,
      prisma.report.count({ where: { event_id: reportData.event_id, user_id: profileId } }),
    ]);
    const target = checkNewReport(caller.profile, {
      event: event && { ...event, status: event.status.name },
      cluster,
      unit,
      clusterId: reportData.cluster_id,
      sentAt: submittedAt,
      hasReport: mine > 0,
    });
    if (!target.ok) return target;

    const grouped = groupReportPhotos(photoFiles(photos), report_casualties.length);
    const [damagePhotoPaths, ...casualtyPhotoPaths] = await Promise.all(
      [grouped.damage, ...grouped.casualties].map(async (files) => {
        const paths = await uploadReportPhotos(id, files);
        uploaded.push(...paths);
        return paths;
      })
    );
    await prisma.$transaction(async (tx) => {
      // One member's reports for an event are written one at a time, so two sent at once can't
      // both pass the one-report check above.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${profileId}::uuid FOR UPDATE`;
      if (!target.admin) {
        const again = await tx.report.count({
          where: { event_id: reportData.event_id, user_id: profileId },
        });
        if (again > 0) throw new DuplicateReport();
      }
      // Inside the transaction: a typed unit is rolled back if the report isn't saved.
      const savedUnitId = await reportUnitIdIn(tx, reportData.cluster_id, unitId, unit_name);
      await tx.report.create({
        data: {
          id,
          event_id: reportData.event_id,
          cluster_id: reportData.cluster_id,
          unit_id: savedUnitId,
          ...mapPopulationCountsToLegacyColumns(population_counts),
          submitted_at: submittedAt,
          user_id: profileId,
          latitude: reportData.latitude ?? null,
          longitude: reportData.longitude ?? null,
          location_name: reportData.location_name ?? null,
          damage_condition_id: reportData.damage_condition_id || null,
          damage_photo_paths: damagePhotoPaths,
          missing_persons: {
            create: report_missing_persons.map(({ name, age, sex }) => ({ name, age, sex })),
          },
          casualties: {
            create: report_casualties.map(({ condition_id, name, age, sex, diagnosis }, i) => ({
              condition_id,
              name,
              age,
              sex,
              diagnosis: diagnosis ?? null,
              photo_paths: casualtyPhotoPaths[i],
            })),
          },
          population_counts: {
            create: population_counts.map(({ category_id, count }) => ({ category_id, count })),
          },
        },
        select: { id: true },
      });
    });
    created = true;

    revalidatePath('/reports');
    return { ok: true, id, photoCount: countPhotos([damagePhotoPaths, ...casualtyPhotoPaths]) };
  } catch (err) {
    // The saved row points at these photos; only a report that wasn't created gives them up.
    if (!created) await removeReportPhotos(uploaded);
    if (err instanceof DuplicateReport) {
      return {
        ok: false,
        error: 'You already sent a report for this event. Open it to make changes.',
        retry: false,
      };
    }
    // A replay of the same report that landed in between: it's already saved.
    if (!created && isUniqueViolation(err)) {
      const existing = await replayOf();
      if (existing) return existing;
    }
    throw toFriendlyError(err, 'report');
  }
}

/** A second report by the same member for the same event, found under the lock. */
class DuplicateReport extends Error {}

/** Saved photo paths a place keeps; unset keeps them all. Checked against the database. */
const keepPhotoPaths = z.array(z.string()).max(20).optional();

const reportEditSchema = reportSchema.omit({ event_id: true }).extend({
  // A casualty already on the report sends its id, so it keeps its row and photos.
  report_casualties: z
    .array(
      casualtySchema.extend({
        id: z.string().uuid().optional(),
        photo_paths: keepPhotoPaths,
      })
    )
    .default([]),
  // The casualties the form loaded and took off. Only these go, so one added since the form
  // opened stays.
  removed_casualty_ids: z.array(z.string().uuid()).default([]),
  damage_photo_paths: keepPhotoPaths,
});
export type ReportEditData = z.input<typeof reportEditSchema>;

/** Locks the report rows so a casualty can't be added to them until the transaction ends. */
const lockReport = (tx: Prisma.TransactionClient, id: string) =>
  tx.$queryRaw`SELECT id FROM reports WHERE id = ${id}::uuid FOR UPDATE`;

/** The report's saved photos: the damage's, and each casualty's by id. */
async function savedReportPhotos(db: Prisma.TransactionClient, id: string) {
  const report = await db.report.findUnique({
    where: { id },
    select: { damage_photo_paths: true, casualties: { select: { id: true, photo_paths: true } } },
  });
  return {
    damage: report?.damage_photo_paths ?? [],
    casualties: new Map((report?.casualties ?? []).map((c) => [c.id, c.photo_paths])),
  };
}

/**
 * Edit report: where, headcount, people, damage and photos in one write, so a failure leaves
 * the report as it was. Headcount and missing persons are replaced; casualties that keep their
 * id are updated in place, new ones added, and only `removed_casualty_ids` are deleted.
 * Photos: `damage_photo_paths` and each casualty's `photo_paths` say which saved photos stay
 * (unset keeps them all); new ones come in `photos`, named as for `createReport`, and are
 * uploaded first. Photos taken off, and uploads that didn't fit, are deleted once the write has
 * committed; on a failure only the uploads go. `photoCount` is how many new photos were saved.
 * Only the report's owner or an in-scope admin may.
 */
export async function saveReportEdits(
  token: string | null,
  id: string,
  data: ReportEditData,
  photos?: FormData
) {
  const owner = await reportOwner(id);
  const caller = checkReportCaller(await requireProfile(token), owner);
  if (!caller.ok) return caller;
  const parsed = reportEditSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? 'This report is incomplete.',
      retry: false,
    };
  }
  const {
    population_counts,
    report_missing_persons,
    report_casualties,
    removed_casualty_ids,
    damage_photo_paths: keepDamage,
    ...fields
  } = parsed.data;
  // The cluster stays on the event's campus and the unit in the cluster (#101).
  const typedUnit = fields.unit_name?.trim();
  const pickedUnit = typedUnit ? null : fields.unit_id || null;
  const [cluster, unit] = await Promise.all([
    prisma.cluster.findUnique({ where: { id: fields.cluster_id }, select: { campus_id: true } }),
    pickedUnit
      ? prisma.unit.findUnique({ where: { id: pickedUnit }, select: { cluster_id: true } })
      : undefined,
  ]);
  if (!cluster || cluster.campus_id !== owner!.event_campus_id) {
    return {
      ok: false as const,
      error: "That cluster isn't on this event's campus. Pick the cluster again.",
      retry: false,
    };
  }
  if (unit === null || (unit && unit.cluster_id !== fields.cluster_id)) {
    return {
      ok: false as const,
      error: "That unit isn't in this cluster. Pick the unit again.",
      retry: false,
    };
  }
  const removed = { report_id: id, id: { in: removed_casualty_ids } };
  // A casualty sent with an id that isn't on this report is updated nowhere, so it takes no
  // photos (they would belong to nothing).
  const savedBefore = await savedReportPhotos(prisma, id);
  const casualtySaved = (c: { id?: string }) =>
    c.id ? (savedBefore.casualties.get(c.id) ?? null) : [];

  const grouped = groupReportPhotos(photoFiles(photos), report_casualties.length);
  const uploaded: string[] = [];
  let committed = false;
  const upload = async (files: File[], room: number) => {
    const paths = await uploadReportPhotos(id, files.slice(0, room));
    uploaded.push(...paths);
    return paths;
  };

  try {
    const [newDamage, ...newCasualty] = await Promise.all([
      upload(grouped.damage, newPhotoRoom(savedBefore.damage, keepDamage)),
      ...report_casualties.map((c, i) => {
        const saved = casualtySaved(c);
        return upload(grouped.casualties[i], saved ? newPhotoRoom(saved, c.photo_paths) : 0);
      }),
    ]);
    const { report, photoPaths, photoCount } = await prisma.$transaction(async (tx) => {
      await lockReport(tx, id);
      // Inside the transaction: a typed unit is rolled back if the edit isn't saved (#101).
      const unitId = await reportUnitIdIn(tx, fields.cluster_id, pickedUnit, typedUnit);
      const gone = await tx.reportCasualty.findMany({
        where: removed,
        select: { photo_paths: true },
      });
      // Read again under the lock, so the merge works on what is saved now.
      const saved = await savedReportPhotos(tx, id);
      const damage = mergePhotoPaths(saved.damage, keepDamage, newDamage);
      const casualties = report_casualties.map(({ photo_paths: keep, ...casualty }, i) => {
        const existing = casualty.id ? saved.casualties.get(casualty.id) : [];
        const merged = existing
          ? mergePhotoPaths(existing, keep, newCasualty[i])
          : { paths: [], removed: newCasualty[i] };
        return { casualty, merged };
      });
      const merges = [damage, ...casualties.map((c) => c.merged)];
      const report = await tx.report.update({
        where: { id },
        data: {
          cluster_id: fields.cluster_id,
          unit_id: unitId,
          damage_condition_id: fields.damage_condition_id || null,
          damage_photo_paths: damage.paths,
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
            updateMany: casualties.flatMap(
              ({ casualty: { id: casualtyId, ...casualty }, merged }) =>
                casualtyId
                  ? [
                      {
                        where: { id: casualtyId },
                        data: { ...casualty, photo_paths: merged.paths },
                      },
                    ]
                  : []
            ),
            create: casualties
              .filter(({ casualty }) => !casualty.id)
              .map(({ casualty, merged }) => ({ ...casualty, photo_paths: merged.paths })),
          },
        },
      });
      const kept = new Set(merges.flatMap((m) => m.paths));
      return {
        report,
        photoPaths: [...gone.flatMap((c) => c.photo_paths), ...merges.flatMap((m) => m.removed)],
        photoCount: uploaded.filter((path) => kept.has(path)).length,
      };
    });
    committed = true;
    await removeReportPhotos(photoPaths);
    revalidatePath('/reports');
    return { ok: true as const, report: serializeReport(report), photoCount };
  } catch (err) {
    // Nothing points at this edit's uploads unless it committed.
    if (!committed) await removeReportPhotos(uploaded);
    throw toFriendlyError(err, 'report');
  }
}

/**
 * Deletes the report (people and headcount cascade), then its photos. Only the report's owner
 * or an in-scope admin may.
 */
export async function deleteReport(
  token: string | null,
  id: string
): Promise<{ ok: true } | ReportRefusal> {
  const caller = checkReportCaller(await requireProfile(token), await reportOwner(id));
  if (!caller.ok) return caller;
  try {
    const photoPaths = await prisma.$transaction(async (tx) => {
      await lockReport(tx, id);
      const report = await tx.report.findUnique({ where: { id }, select: REPORT_PHOTO_SELECT });
      await tx.report.delete({ where: { id } });
      return report ? reportPhotoPaths([report]) : [];
    });
    await removeReportPhotos(photoPaths);
    revalidatePath('/reports');
    return { ok: true };
  } catch (err) {
    throw toFriendlyError(err, 'report');
  }
}

export type ReportPhotoUrls =
  | {
      ok: true;
      damage: string[];
      casualties: { id: string; name: string; condition: string | null; urls: string[] }[];
      /** Every signed link by its storage path, for Edit report to show and remove photos. */
      byPath: Record<string, string>;
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
    if (!isUuid(reportId)) {
      return { ok: false, error: 'This report could not be found.', retry: false };
    }

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
      byPath: Object.fromEntries(urls),
    };
  } catch {
    return {
      ok: false,
      error: 'The photos could not be loaded. Try again in a moment.',
      retry: true,
    };
  }
}

/** The signed-in member's report on an ongoing event, or null (#87: never another user's). */
export async function getMyReportForOngoingEvent(token: string | null) {
  const caller = await requireProfile(token);
  if (!caller.ok) return null;
  const userId = caller.profile.id;
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

/** The signed-in member's most recent report on any event — shown when no event is ongoing. */
export async function getMyLatestReport(token: string | null) {
  const caller = await requireProfile(token);
  if (!caller.ok) return null;
  const userId = caller.profile.id;
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
/** A report's casualties. Only the report's owner or an in-scope admin may see them. */
export async function getReportCasualties(token: string | null, reportId: string) {
  const owner = await reportOwner(reportId);
  const caller = checkReportCaller(
    await requireProfile(token),
    owner && { ...owner, event_open: true }
  );
  if (!caller.ok) return caller;
  const casualties = await prisma.reportCasualty.findMany({
    where: { report_id: reportId },
    include: { condition: { select: { name: true } } },
    orderBy: { condition: { name: 'asc' } },
  });
  return { ok: true as const, casualties };
}

/**
 * The report's owner, campus and whether its event is still ongoing, for `checkReportCaller`;
 * null when it is gone (or the id isn't one).
 */
async function reportOwner(reportId: unknown) {
  if (!isUuid(reportId)) return null;
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      user_id: true,
      cluster: { select: { campus_id: true } },
      event: { select: { campus_id: true, status: { select: { name: true } } } },
    },
  });
  return (
    report && {
      user_id: report.user_id,
      campus_id: report.cluster.campus_id,
      event_campus_id: report.event.campus_id,
      event_open: isOngoing(report.event.status.name),
    }
  );
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
  if (!isUuid(id)) return REPORT_NOT_FOUND;
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
/** A report's missing persons. Only the report's owner or an in-scope admin may see them. */
export async function getReportMissingPersons(token: string | null, reportId: string) {
  const owner = await reportOwner(reportId);
  // Reading isn't changing: the owner may still see them after the event ends.
  const caller = checkReportCaller(
    await requireProfile(token),
    owner && { ...owner, event_open: true }
  );
  if (!caller.ok) return caller;
  const missingPersons = await prisma.reportMissingPerson.findMany({
    where: { report_id: reportId },
    orderBy: { created_at: 'asc' },
  });
  return { ok: true as const, missingPersons };
}

/** Adds a missing person to a report. Only the report's owner or an in-scope admin may. */
export async function createReportMissingPerson(
  token: string | null,
  data: MissingPersonFormData & { report_id: string }
) {
  const caller = checkReportCaller(await requireProfile(token), await reportOwner(data.report_id));
  if (!caller.ok) return caller;
  // Write only the parsed fields, so a client can't set bystander_report_id or id.
  const parsed = missingPersonSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? 'Check the missing person.',
      retry: false,
    };
  }
  const missingPerson = await prisma.reportMissingPerson.create({
    data: { ...parsed.data, report_id: data.report_id },
  });
  revalidatePath('/reports');
  return { ok: true as const, missingPerson };
}

/** Removes a missing person. Only the report's owner or an in-scope admin may. */
export async function deleteReportMissingPerson(
  token: string | null,
  id: string
): Promise<{ ok: true } | ReportRefusal> {
  if (!isUuid(id)) return REPORT_NOT_FOUND;
  const person = await prisma.reportMissingPerson.findUnique({
    where: { id },
    select: { report_id: true },
  });
  const owner = person?.report_id ? await reportOwner(person.report_id) : null;
  const caller = checkReportCaller(await requireProfile(token), owner);
  if (!caller.ok) return caller;

  await prisma.reportMissingPerson.delete({ where: { id } });
  revalidatePath('/reports');
  return { ok: true };
}
