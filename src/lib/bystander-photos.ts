import { randomUUID } from 'crypto';
import { BYSTANDER_MAX_PHOTOS } from './constants';
import { supabaseAdmin } from './supabase-admin';

// Server-only: bystander damage photos live in a private Storage bucket and are reached only
// through the service-role client. Kept out of `src/lib/index.ts` so it never lands in a
// client bundle.

/** Private bucket created by prisma/manual/DRRM-008-bystander-report-v2.sql. */
const BUCKET = 'bystander-photos';

/** The browser sends ~1600px JPEGs well under this; anything larger didn't come from the form. */
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Returns the JPEG without its metadata: every APPn segment except APP0 (JFIF) and APP2 (ICC
 * colour profile), and every comment. That drops Exif (including GPS), XMP and IPTC. The form
 * already re-encodes photos through a canvas, which removes them; this is the server-side
 * backstop for a client that skips that step. Returns null when the bytes aren't a JPEG.
 */
function stripJpegMetadata(input: Uint8Array): Uint8Array | null {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) return null;

  const kept: Uint8Array[] = [input.subarray(0, 2)];
  let i = 2;
  while (i + 1 < input.length) {
    if (input[i] !== 0xff) return null;
    const marker = input[i + 1];

    // Fill byte — any number of 0xFF may pad the space before a marker.
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    // TEM and RSTn stand alone, with no length.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(input.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (i + 3 >= input.length) return null;

    const end = i + 2 + ((input[i + 2] << 8) | input[i + 3]);
    if (end > input.length || end < i + 4) return null;

    // Start of scan: everything from here on is image data.
    if (marker === 0xda) {
      kept.push(input.subarray(i));
      return Buffer.concat(kept);
    }

    const isMetadata = (marker >= 0xe1 && marker <= 0xef && marker !== 0xe2) || marker === 0xfe;
    if (!isMetadata) kept.push(input.subarray(i, end));
    i = end;
  }
  return null;
}

/**
 * Uploads up to `BYSTANDER_MAX_PHOTOS` photos under `<reportId>/` and returns their object
 * paths, in the order they were sent. A photo that isn't a JPEG, is too large or fails to
 * upload is skipped: a photo problem must never block an emergency report.
 */
export async function uploadBystanderPhotos(reportId: string, photos: Blob[]): Promise<string[]> {
  const paths = await Promise.all(
    photos.slice(0, BYSTANDER_MAX_PHOTOS).map(async (photo) => {
      if (photo.size === 0 || photo.size > MAX_PHOTO_BYTES) return null;
      const stripped = stripJpegMetadata(new Uint8Array(await photo.arrayBuffer()));
      if (!stripped) return null;

      const path = `${reportId}/${randomUUID()}.jpg`;
      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, stripped, { contentType: 'image/jpeg', upsert: false });
      if (error) {
        console.error(`[bystander-photos] upload failed for ${path}: ${error.message}`);
        return null;
      }
      return path;
    })
  );
  return paths.filter((path): path is string => path !== null);
}

/** Best-effort cleanup for photos whose report was never saved. */
export async function removeBystanderPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths);
  if (error) console.error(`[bystander-photos] cleanup failed: ${error.message}`);
}

/** One-hour signed URLs for showing a report's photos to an admin. */
export async function signBystanderPhotos(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw new Error('Could not load the photos for this report.');
  return data.flatMap((entry) => (entry.signedUrl ? [entry.signedUrl] : []));
}
