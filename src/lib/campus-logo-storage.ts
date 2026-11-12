import { randomUUID } from 'crypto';
import { CAMPUS_LOGO_BUCKET, CAMPUS_LOGO_MAX_BYTES, CAMPUS_LOGO_TYPES } from './campus-logo';
import { supabaseAdmin } from './supabase-admin';

// Server-only: uploaded campus logos in the public `campus-logos` bucket, written with the
// service-role client. Kept out of `src/lib/index.ts` so it never lands in a client bundle.

const EXTENSION: Record<(typeof CAMPUS_LOGO_TYPES)[number], string> = {
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Why a logo file is refused, or null when it is fine to upload. */
export function logoProblem(file: { type: string; size: number }): string | null {
  if (!(CAMPUS_LOGO_TYPES as readonly string[]).includes(file.type)) {
    return 'The logo must be a PNG or WebP image.';
  }
  if (file.size === 0 || file.size > CAMPUS_LOGO_MAX_BYTES) {
    return 'The logo must be under 1 MB.';
  }
  return null;
}

/**
 * Uploads the logo under `<campusId>/` with a new name each time, so a replaced logo is never
 * served from a cache. Returns its path, or throws.
 */
export async function uploadCampusLogo(campusId: string, file: File): Promise<string> {
  const type = file.type as (typeof CAMPUS_LOGO_TYPES)[number];
  const path = `${campusId}/${randomUUID()}.${EXTENSION[type]}`;
  const { error } = await supabaseAdmin.storage
    .from(CAMPUS_LOGO_BUCKET)
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: type,
      cacheControl: '31536000',
      upsert: false,
    });
  if (error) throw error;
  return path;
}

/** Deletes logos that nothing points at any more. Never throws: a leftover file is harmless. */
export async function removeCampusLogos(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return;
  try {
    await supabaseAdmin.storage.from(CAMPUS_LOGO_BUCKET).remove(list);
  } catch (err) {
    console.error('Campus logo cleanup failed', err);
  }
}
