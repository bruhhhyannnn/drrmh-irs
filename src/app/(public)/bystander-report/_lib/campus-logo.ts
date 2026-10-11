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

export function campusLogo(campusName: string): string {
  const slug = campusName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^up\s+/, '')
    .replace(/[^a-z]/g, '');
  return CAMPUS_LOGOS.has(slug) ? `/up-${slug}-logo.png` : '/up-logo.png';
}
