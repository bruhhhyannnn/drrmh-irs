import { BYSTANDER_MAX_PHOTOS } from './constants';
import { photoBucket } from './photo-storage';

// Server-only, like photo-storage.ts: bystander damage photos, under `<reportId>/`.

/**
 * Private bucket created by prisma/manual/DRRM-008-bystander-report-v2.sql. The browser sends
 * ~1600px JPEGs well under 3 MB; anything larger didn't come from the form.
 */
const bucket = photoBucket('bystander-photos', 3 * 1024 * 1024);

/** Uploads up to `BYSTANDER_MAX_PHOTOS` photos; see `photoBucket`. */
export function uploadBystanderPhotos(reportId: string, photos: Blob[]): Promise<string[]> {
  return bucket.upload(reportId, photos.slice(0, BYSTANDER_MAX_PHOTOS));
}

export const removeBystanderPhotos = bucket.remove;

/** One-hour signed URLs for showing a report's photos to an admin, in the report's order. */
export async function signBystanderPhotos(paths: string[]): Promise<string[]> {
  const urls = await bucket.sign(paths);
  return paths.flatMap((path) => urls.get(path) ?? []);
}
