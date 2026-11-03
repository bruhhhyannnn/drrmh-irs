import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  BYSTANDER_PHOTO_FIELD,
  HEADCOUNT_FIELDS,
  REPORT_MAX_PHOTOS,
  REPORT_PHOTO_BUDGET_BYTES,
  REPORT_PHOTO_FIELD,
} from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Transitional shim: report submissions write both `report_population_counts` rows
// and (for the 12 original codes) the legacy flat columns on `reports`, so dashboards
// and exports that still read those columns keep working for new campuses reports.
// Delete this once those read paths are migrated onto report_population_counts.
const LEGACY_POPULATION_CODES = new Set(HEADCOUNT_FIELDS.map((f) => f.key as string));

export function mapPopulationCountsToLegacyColumns(counts: { code: string; count: number }[]) {
  return Object.fromEntries(
    counts.filter((c) => LEGACY_POPULATION_CODES.has(c.code)).map((c) => [c.code, c.count])
  ) as Record<string, number>;
}

export function totalPopulationCount(counts: { count: number }[]): number {
  return counts.reduce((sum, c) => sum + c.count, 0);
}

export const toSettingsPath = (title: string) =>
  `/settings/${title.toLowerCase().replace(/\s+/g, '-')}`;

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** Packs bystander photos for `createBystanderReport`; undefined when there are none. */
export function toBystanderPhotoFormData(photos: Blob[] | undefined): FormData | undefined {
  if (!photos?.length) return undefined;
  const formData = new FormData();
  photos.forEach((photo, i) => formData.append(BYSTANDER_PHOTO_FIELD, photo, `photo-${i + 1}.jpg`));
  return formData;
}

// A field report's photos travel in one FormData field, and each file's name says whose photo
// it is: `damage-1.jpg`, or `casualty-<i>-1.jpg` for casualty i in `report_casualties` order.
// The offline queue keeps the files as they are, so the names survive a replay.

const jpeg = (blob: Blob, name: string) => new File([blob], name, { type: 'image/jpeg' });

/** Names a new report's photos for `createReport` and the offline queue. */
export function reportPhotoFiles(damage: Blob[], casualties: Blob[][]): File[] {
  return [
    ...damage.map((blob, i) => jpeg(blob, `damage-${i + 1}.jpg`)),
    ...casualties.flatMap((photos, c) =>
      photos.map((blob, i) => jpeg(blob, `casualty-${c}-${i + 1}.jpg`))
    ),
  ];
}

/** Packs report photos for `createReport` or `createReportCasualty`; undefined when there are none. */
export function toReportPhotoFormData(photos: Blob[] | undefined): FormData | undefined {
  if (!photos?.length) return undefined;
  const formData = new FormData();
  photos.forEach((photo, i) =>
    formData.append(
      REPORT_PHOTO_FIELD,
      photo,
      photo instanceof File ? photo.name : `photo-${i + 1}.jpg`
    )
  );
  return formData;
}

/**
 * Sorts the photos `createReport` received into the damage answer and each casualty, by file
 * name. Keeps at most `REPORT_MAX_PHOTOS` per place and `REPORT_PHOTO_BUDGET_BYTES` in all, in
 * the order sent; a file with any other name, or for a casualty that isn't there, is left out.
 */
export function groupReportPhotos(files: File[], casualtyCount: number) {
  const damage: File[] = [];
  const casualties: File[][] = Array.from({ length: casualtyCount }, () => []);
  let bytes = 0;
  for (const file of files) {
    const match = /^(?:damage|casualty-(\d+))-\d+\.jpg$/.exec(file.name);
    if (!match) continue;
    const place = match[1] === undefined ? damage : casualties[Number(match[1])];
    if (!place || place.length >= REPORT_MAX_PHOTOS) continue;
    if (bytes + file.size > REPORT_PHOTO_BUDGET_BYTES) continue;
    bytes += file.size;
    place.push(file);
  }
  return { damage, casualties };
}
