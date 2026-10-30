import type { Prisma } from '@prisma/client';
import { REPORT_MAX_PHOTOS } from './constants';
import { photoBucket } from './photo-storage';
import { prisma } from './prisma';

// Server-only, like photo-storage.ts: field report photos (structural damage and casualties),
// all under `<reportId>/`. Casualty photos are health information, so they are only ever shown
// to admins, through signed URLs.

/**
 * Private bucket created by prisma/manual/DRRM-022-report-photos.sql. The phone sends ~1280px
 * JPEGs well under 1.5 MB; anything larger didn't come from the form.
 */
const bucket = photoBucket('report-photos', 1.5 * 1024 * 1024);

/** Uploads up to `REPORT_MAX_PHOTOS` photos for one place on a report; see `photoBucket`. */
export function uploadReportPhotos(reportId: string, photos: Blob[]): Promise<string[]> {
  return bucket.upload(reportId, photos.slice(0, REPORT_MAX_PHOTOS));
}

export const removeReportPhotos = bucket.remove;
export const signReportPhotos = bucket.sign;

/** Every photo on the reports `where` picks: their damage photos and their casualties'. */
export async function reportPhotoPaths(where: Prisma.ReportWhereInput): Promise<string[]> {
  const reports = await prisma.report.findMany({
    where,
    select: { damage_photo_paths: true, casualties: { select: { photo_paths: true } } },
  });
  return reports.flatMap((r) => [
    ...r.damage_photo_paths,
    ...r.casualties.flatMap((c) => c.photo_paths),
  ]);
}
