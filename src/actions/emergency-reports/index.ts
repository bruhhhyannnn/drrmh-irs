'use server';

import { BYSTANDER_PHOTO_FIELD, bystanderReportSchema, type BystanderReportFormData } from '@/lib';
import {
  removeBystanderPhotos,
  signBystanderPhotos,
  uploadBystanderPhotos,
} from '@/lib/bystander-photos';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';

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

export async function getBystanderReports(campusId?: string) {
  const reports = await prisma.bystander_reports.findMany({
    where: campusId ? { clusters: { campus_id: campusId } } : undefined,
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

  return reports.map((r) => ({
    ...r,
    latitude: r.latitude.toNumber(),
    longitude: r.longitude.toNumber(),
  }));
}

export async function updateBystanderReportStatus(
  id: string,
  statusName: 'reviewed' | 'verified' | 'dismissed'
) {
  const status = await prisma.bystander_report_statuses.findFirst({
    where: { name: statusName },
  });

  try {
    const report = await prisma.bystander_reports.update({
      where: { id },
      data: { status_id: status?.id },
    });

    revalidatePath('/emergency-reports');
    return {
      ...report,
      latitude: report.latitude.toNumber(),
      longitude: report.longitude.toNumber(),
    };
  } catch (err) {
    throw toFriendlyError(err, 'bystander report');
  }
}

/** The sidebar badge and dashboard tile: reports nobody has looked at yet. */
export async function getPendingBystanderCount(campusId?: string) {
  return prisma.bystander_reports.count({
    where: {
      ...(campusId && { clusters: { campus_id: campusId } }),
      OR: [{ status_id: null }, { bystander_report_statuses: { name: 'pending' } }],
    },
  });
}

export async function deleteBystanderReport(id: string) {
  try {
    await prisma.bystander_reports.delete({ where: { id } });
    revalidatePath('/emergency-reports');
  } catch (err) {
    throw toFriendlyError(err, 'bystander report');
  }
}

/** Short-lived signed URLs for a report's photos, fetched when an admin opens the report. */
export async function getBystanderPhotoUrls(id: string) {
  const report = await prisma.bystander_reports.findUnique({
    where: { id },
    select: { photo_paths: true },
  });
  return signBystanderPhotos(report?.photo_paths ?? []);
}

export async function getBystanderIncidentTypes() {
  return prisma.bystander_incident_types.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}
