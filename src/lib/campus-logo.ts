// Campus logos in /public are named up-<campus>-logo.png ("UP Los Baños" → up-losbanos-logo.png).
// A campus without its own logo (e.g. UP PGH) falls back to the UP seal.
const CAMPUS_LOGOS = new Set([
  'baguio',
  'cebu',
  'diliman',
  'losbanos',
  'manila',
  'mindanao',
  'openuniversity',
  'tacloban',
  'visayas',
]);

function campusSlug(campusName: string) {
  return campusName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^up\s+/, '')
    .replace(/[^a-z]/g, '');
}

/** Bucket for uploaded logos (prisma/manual/DRRM-036-campus-logo.sql); public. */
export const CAMPUS_LOGO_BUCKET = 'campus-logos';
/** Logos are scaled to this square before upload, and the bucket takes up to 1 MB. */
export const CAMPUS_LOGO_EDGE = 512;
export const CAMPUS_LOGO_MAX_BYTES = 1024 * 1024;
export const CAMPUS_LOGO_TYPES = ['image/png', 'image/webp'] as const;

/** The public URL of an uploaded logo. */
export function campusLogoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${CAMPUS_LOGO_BUCKET}/${path}`;
}

/**
 * The campus's logo: the uploaded one (`uploaded`, a URL), then the bundled file in /public,
 * then the UP seal.
 */
export function campusLogo(campusName: string, uploaded?: string | null): string {
  return ownCampusLogo(campusName, uploaded) ?? '/up-logo.png';
}

/** The campus's own logo (uploaded, then bundled), or null when it has none. */
export function ownCampusLogo(campusName: string, uploaded?: string | null): string | null {
  if (uploaded) return uploaded;
  const slug = campusSlug(campusName);
  return CAMPUS_LOGOS.has(slug) ? `/up-${slug}-logo.png` : null;
}
