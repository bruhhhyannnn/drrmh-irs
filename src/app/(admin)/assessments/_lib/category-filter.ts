import type { BuildingCategory } from '@/lib/building-place';

// The Campus / Off-campus filter on the admin Assessments tabs (DRRM-024). The pages open on Campus,
// so they read as they always have until someone asks for off-campus results.

export type CategoryFilter = BuildingCategory | 'all';

export function categoryFromParam(value: string | null): CategoryFilter {
  return value === 'off_campus' || value === 'all' ? value : 'campus';
}

export function filterByCategory<T extends { category: BuildingCategory }>(
  rows: T[],
  category: CategoryFilter
): T[] {
  return category === 'all' ? rows : rows.filter((row) => row.category === category);
}

/** The clusters among these rows, by name. An off-campus row has none. */
export function clusterOptions<T extends { cluster: { id: string; name: string } | null }>(
  rows: T[]
): { id: string; name: string }[] {
  const clusters = new Map(
    rows.flatMap((r) => (r.cluster ? [[r.cluster.id, r.cluster]] : [])) as [
      string,
      { id: string; name: string },
    ][]
  );
  return [...clusters.values()].sort((a, b) => a.name.localeCompare(b.name));
}
