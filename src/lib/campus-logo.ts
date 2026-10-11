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

export function campusLogo(campusName: string): string {
  return ownCampusLogo(campusName) ?? '/up-logo.png';
}

/** The campus's own logo, or null when it has none (the admin pages show its initials). */
export function ownCampusLogo(campusName: string): string | null {
  const slug = campusSlug(campusName);
  return CAMPUS_LOGOS.has(slug) ? `/up-${slug}-logo.png` : null;
}
