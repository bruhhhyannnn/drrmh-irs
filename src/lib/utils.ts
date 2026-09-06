import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HEADCOUNT_FIELDS } from './constants';

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

type PopulationCountLike = { count: number; category: { id: string; name: string } };

export function totalPopulationCount(counts: { count: number }[]): number {
  return counts.reduce((sum, c) => sum + c.count, 0);
}

// Aggregates population counts across reports by category, preserving each
// category's first-seen order (which matches campus sort_order at submit time).
export function sumPopulationCountsByCategory<
  T extends { population_counts: PopulationCountLike[] },
>(items: T[]): { id: string; name: string; total: number }[] {
  const totals = new Map<string, { id: string; name: string; total: number }>();
  for (const item of items) {
    for (const pc of item.population_counts) {
      const existing = totals.get(pc.category.id);
      if (existing) {
        existing.total += pc.count;
      } else {
        totals.set(pc.category.id, { id: pc.category.id, name: pc.category.name, total: pc.count });
      }
    }
  }
  return Array.from(totals.values());
}

export function uniquePopulationCategories<T extends { population_counts: PopulationCountLike[] }>(
  items: T[]
): { id: string; name: string }[] {
  const seen = new Map<string, { id: string; name: string }>();
  for (const item of items) {
    for (const pc of item.population_counts) {
      if (!seen.has(pc.category.id))
        seen.set(pc.category.id, { id: pc.category.id, name: pc.category.name });
    }
  }
  return Array.from(seen.values());
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
