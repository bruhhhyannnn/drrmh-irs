'use server';

import { BYSTANDER_PHOTO_FIELD, bystanderReportSchema, type BystanderReportFormData } from '@/lib';
import { inScope } from '@/lib/admin-scope';
import {
  removeBystanderPhotos,
  signBystanderPhotos,
  uploadBystanderPhotos,
} from '@/lib/bystander-photos';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { requireAdmin } from '@/lib/server-auth';
import { isUuid, type ActionRefusal } from '@/lib/utils';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';

// The QR form's submit and incident types stay public. Everything else is for admins, and only
// for reports on a campus their verified scope covers (#102): these hold reporters' phone
// numbers, casualties' diagnoses and private photos.

const ADMIN_ONLY: ActionRefusal = {
  ok: false,
  error: 'Sign in as an administrator to manage bystander reports.',
  retry: false,
};
const NOT_FOUND: ActionRefusal = {
  ok: false,
  error: 'This report could not be found. It may have been removed.',
  retry: false,
};

/** The most reports the Bystander reports page loads at once, newest first (#109). */
const BYSTANDER_LIST_LIMIT = 500;

/** The statuses an admin may set. */
const SETTABLE_STATUSES = ['reviewed', 'verified', 'dismissed'] as const;

/** The report if it is on a campus this admin may see; null otherwise. */
async function reportInScope(scope: Parameters<typeof inScope>[0], id: unknown) {
  if (!isUuid(id)) return null;
  const report = await prisma.bystander_reports.findUnique({
    where: { id },
    select: { id: true, photo_paths: true, clusters: { select: { campus_id: true } } },
  });
  return report && inScope(scope, report.clusters?.campus_id ?? null) ? report : null;
}

/**
 * Creates an anonymous bystander report. `photos` carries up to 3 JPEGs under the `photos`
 * field (see `toBystanderPhotoFormData`). Photos are uploaded first so the report row can
 * hold their paths; if the row then fails to save, the uploads are removed again.
 */
export async function createBystanderReport(data: BystanderReportFormData, photos?: FormData) {
  const parsed = bystanderReportSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'This report is incomplete.');
  }
  const { report_missing_persons, report_casualties, population_counts, ...reportData } =
    parsed.data;

  const [cluster, pendingStatus] = await Promise.all([
    prisma.cluster.findUnique({
      where: { id: reportData.cluster_id },
      select: { campus_id: true },
    }),
    prisma.bystander_report_statuses.findFirst({ where: { name: 'pending' } }),
  ]);
  if (!cluster) throw new Error('The selected cluster no longer exists. Please choose another.');

  // Headcount fields follow the cluster's campus; zeros mean "not counted" and aren't stored.
  const campusCategories = await prisma.campusPopulationCategory.findMany({
    where: { campus_id: cluster.campus_id, is_active: true },
    select: { category_id: true },
  });
  const allowedCategories = new Set(campusCategories.map((c) => c.category_id));
  const counts = population_counts.filter(
    (c) => c.count > 0 && allowedCategories.has(c.category_id)
  );

  const id = randomUUID();
  const photoBlobs = (photos?.getAll(BYSTANDER_PHOTO_FIELD) ?? []).filter(
    (entry): entry is File => typeof entry !== 'string'
  );
  const photoPaths = await uploadBystanderPhotos(id, photoBlobs);

  try {
    const report = await prisma.bystander_reports.create({
      data: {
        ...reportData,
        id,
        status_id: pendingStatus?.id,
        photo_paths: photoPaths,
        ...(counts.length && { population_counts: { create: counts } }),
        ...(report_missing_persons.length && {
          report_missing_persons: { create: report_missing_persons },
        }),
        ...(report_casualties.length && { report_casualties: { create: report_casualties } }),
      },
      select: { id: true, submitted_at: true },
    });

    return {
      id: report.id,
      submittedAt: report.submitted_at.toISOString(),
      photoCount: photoPaths.length,
    };
  } catch (err) {
    await removeBystanderPhotos(photoPaths);
    throw toFriendlyError(err, 'bystander report');
  }
}

/**
 * The Bystander reports page: the caller's scope only, newest first; empty for non-admins.
 * `truncated` says the scope holds more than `limit`, so the page can say it shows the newest ones.
 */
export async function getBystanderReports(token: string | null, campusId?: string) {
  const caller = await requireAdmin(token, campusId || null);
  if (!caller.ok) return { reports: [], truncated: false, limit: BYSTANDER_LIST_LIMIT };
  const scopeCampus = caller.scope.campusId;
  // One extra row tells whether the list was cut short.
  const fetched = await prisma.bystander_reports.findMany({
    where: scopeCampus ? { clusters: { campus_id: scopeCampus } } : undefined,
    take: BYSTANDER_LIST_LIMIT + 1,
    include: {
      clusters: { include: { campus: { select: { name: true } } } },
      units: true,
      bystander_incident_types: true,
      bystander_report_statuses: true,
      damage_conditions: { select: { name: true } },
      report_missing_persons: true,
      report_casualties: { include: { condition: { select: { name: true } } } },
      population_counts: {
        include: { category: { select: { name: true } } },
        orderBy: { count: 'desc' },
      },
    },
    orderBy: {
      submitted_at: 'desc',
    },
  });

  const truncated = fetched.length > BYSTANDER_LIST_LIMIT;
  const reports = fetched.slice(0, BYSTANDER_LIST_LIMIT);
  const unseen = await unseenBystanderIds(reports.map((r) => r.id));
  return {
    reports: reports.map((r) => ({
      ...r,
      latitude: r.latitude.toNumber(),
      longitude: r.longitude.toNumber(),
      /** No admin has opened it yet (DRRM-042). */
      unopened: unseen.has(r.id),
    })),
    truncated,
    limit: BYSTANDER_LIST_LIMIT,
  };
}

/**
 * The reports no admin has opened yet. Reads `seen_at` with its own query, so before
 * prisma/manual/DRRM-042-bystander-seen.sql runs nothing counts as unopened.
 */
async function unseenBystanderIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  try {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM public.bystander_reports
      WHERE id = ANY(${ids}::uuid[]) AND seen_at IS NULL`;
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

/** An admin opened the report: it stops showing as unopened. Admins only; never throws. */
export async function markBystanderReportSeen(token: string | null, id: string) {
  const caller = await requireAdmin(token);
  if (!caller.ok || !(await reportInScope(caller.scope, id))) return { ok: false as const };
  try {
    await prisma.$executeRaw`
      UPDATE public.bystander_reports SET seen_at = now()
      WHERE id = ${id}::uuid AND seen_at IS NULL`;
  } catch {
    // Before the DRRM-042 SQL runs there is nothing to mark.
  }
  return { ok: true as const };
}

export async function updateBystanderReportStatus(
  token: string | null,
  id: string,
  statusName: (typeof SETTABLE_STATUSES)[number]
): Promise<{ ok: true } | ActionRefusal> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  if (!SETTABLE_STATUSES.includes(statusName)) {
    return { ok: false, error: 'That status is not one an admin can set.', retry: false };
  }
  if (!(await reportInScope(caller.scope, id))) return NOT_FOUND;
  const status = await prisma.bystander_report_statuses.findFirst({
    where: { name: statusName },
    select: { id: true },
  });
  if (!status) return { ok: false, error: `The ${statusName} status is missing.`, retry: false };

  try {
    await prisma.bystander_reports.update({ where: { id }, data: { status_id: status.id } });
    revalidatePath('/emergency-reports');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toFriendlyError(err, 'bystander report').message, retry: false };
  }
}

/** The sidebar badge and dashboard tile: reports nobody has looked at yet. */
export async function getPendingBystanderCount(token: string | null, campusId?: string) {
  const caller = await requireAdmin(token, campusId || null);
  if (!caller.ok) return 0;
  const scopeCampus = caller.scope.campusId;
  return prisma.bystander_reports.count({
    where: {
      ...(scopeCampus && { clusters: { campus_id: scopeCampus } }),
      OR: [{ status_id: null }, { bystander_report_statuses: { name: 'pending' } }],
    },
  });
}

/** Deletes the report (its people and headcount cascade), then its photos in Storage. */
export async function deleteBystanderReport(
  token: string | null,
  id: string
): Promise<{ ok: true } | ActionRefusal> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  const report = await reportInScope(caller.scope, id);
  if (!report) return NOT_FOUND;
  try {
    await prisma.bystander_reports.delete({ where: { id: report.id } });
  } catch (err) {
    return { ok: false, error: toFriendlyError(err, 'bystander report').message, retry: false };
  }
  // Only once the row is gone, so a failed delete keeps its photos.
  await removeBystanderPhotos(report.photo_paths);
  revalidatePath('/emergency-reports');
  return { ok: true };
}

/**
 * Short-lived signed URLs for a report's photos, fetched when an admin opens the report. Admins
 * only, for a report in their scope; none otherwise.
 */
export async function getBystanderPhotoUrls(token: string | null, id: string) {
  const caller = await requireAdmin(token);
  if (!caller.ok) return [];
  const report = await reportInScope(caller.scope, id);
  return signBystanderPhotos(report?.photo_paths ?? []);
}

export async function getBystanderIncidentTypes() {
  return prisma.bystander_incident_types.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}
