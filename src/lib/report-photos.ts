import { REPORT_MAX_PHOTOS, REPORT_PHOTO_MAX_BYTES } from './constants';
import { photoBucket } from './photo-storage';

// Server-only, like photo-storage.ts: field report photos (structural damage and casualties),
// all under `<reportId>/`. Casualty photos are health information, so they are only ever shown
// to admins, through signed URLs.

/**
 * Private bucket created by prisma/manual/DRRM-022-report-photos.sql. The form doesn't add a
 * photo over `REPORT_PHOTO_MAX_BYTES`; anything larger didn't come from it.
 */
const bucket = photoBucket('report-photos', REPORT_PHOTO_MAX_BYTES);

/** Uploads up to `REPORT_MAX_PHOTOS` photos for one place on a report; see `photoBucket`. */
export function uploadReportPhotos(reportId: string, photos: Blob[]): Promise<string[]> {
  return bucket.upload(reportId, photos.slice(0, REPORT_MAX_PHOTOS));
}

export const removeReportPhotos = bucket.remove;
export const signReportPhotos = bucket.sign;

/** Every photo on the reports given: their damage photos and their casualties'. */
export function reportPhotoPaths(
  reports: { damage_photo_paths: string[]; casualties: { photo_paths: string[] }[] }[]
): string[] {
  return reports.flatMap((r) => [
    ...r.damage_photo_paths,
    ...r.casualties.flatMap((c) => c.photo_paths),
  ]);
}

/** The select `reportPhotoPaths` reads. */
export const REPORT_PHOTO_SELECT = {
  damage_photo_paths: true,
  casualties: { select: { photo_paths: true } },
} as const;
