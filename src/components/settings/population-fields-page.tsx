'use client';

import { PageBreadcrumb } from '@/components/common';
import {
  useCampusPopulationCategoryCounts,
  usePopulationCategories,
} from '@/components/hooks/use-population-categories';
import { useCampus } from '@/components/hooks/use-settings';
import { PageError } from '@/components/ui';
import { CampusFieldsCard } from './campus-fields-card';

export function PopulationFieldsPage() {
  const { data: categories, error: categoriesError } = usePopulationCategories();
  const { data: campuses, isPending: campusesPending } = useCampus();
  const { data: campusCounts } = useCampusPopulationCategoryCounts();

  const countByCampusId = new Map((campusCounts ?? []).map((c) => [c.campus_id, c.count]));

  // Campuses already configured with real fields surface first; the rest (still on
  // the default seed, unused for now) sink to the bottom.
  const activeCampuses = ((campuses ?? []) as { id: string; name: string; is_active: boolean }[])
    .filter((c) => c.is_active)
    .sort((a, b) => {
      const aConfigured = (countByCampusId.get(a.id) ?? 0) > 0;
      const bConfigured = (countByCampusId.get(b.id) ?? 0) > 0;
      if (aConfigured !== bConfigured) return aConfigured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  if (categoriesError) return <PageError message={categoriesError.message} />;

  return (
    <div className="space-y-8">
      <PageBreadcrumb pageTitle="Population Fields" />

      {/* ─── Per-campus field assignment ─── */}
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Campus Fields
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Each campus keeps its own set of fields, order, and required flags. Add a new field
            directly from a campus's card below, or edit/remove one from its row.
          </p>
        </div>

        {campusesPending ? (
          <p className="text-sm text-gray-400">Loading campuses...</p>
        ) : !activeCampuses.length ? (
          <p className="text-sm text-gray-400">No active campuses found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {activeCampuses.map((campus) => (
              <CampusFieldsCard
                key={campus.id}
                campusId={campus.id}
                campusName={campus.name}
                categories={categories ?? []}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
