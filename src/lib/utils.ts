import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BYSTANDER_PHOTO_FIELD, HEADCOUNT_FIELDS } from './constants';

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
