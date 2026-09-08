'use server';

import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { revalidatePath } from 'next/cache';

function revalidatePopulationFields() {
  revalidatePath('/settings/population-fields');
}

/* ─── Category catalog (site-wide) ─── */

export async function getPopulationCategories() {
  return prisma.populationCategory.findMany({ orderBy: { name: 'asc' } });
}

export async function createPopulationCategory(data: {
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
}) {
  try {
    const category = await prisma.populationCategory.create({ data });
    revalidatePopulationFields();
    return category;
  } catch (err) {
    throw toFriendlyError(err, 'population category');
  }
}

export async function updatePopulationCategory(
  id: string,
  data: Partial<{ code: string; name: string; description: string; is_active: boolean }>
) {
  try {
    const category = await prisma.populationCategory.update({ where: { id }, data });
    revalidatePopulationFields();
    return category;
  } catch (err) {
    throw toFriendlyError(err, 'population category');
  }
}

/* ─── Per-campus field assignment ─── */

// Used by the report form: only the fields a campus currently has enabled, in order.
export async function getCampusPopulationCategories(campusId: string) {
  return prisma.campusPopulationCategory.findMany({
    where: { campus_id: campusId, is_active: true },
    orderBy: { sort_order: 'asc' },
    include: { category: true },
  });
}

// Used by the admin management page: every assignment for a campus, including inactive
// ones, so they can be reviewed and re-enabled without losing history.
export async function getCampusPopulationCategoryAssignments(campusId: string) {
  return prisma.campusPopulationCategory.findMany({
    where: { campus_id: campusId },
    orderBy: { sort_order: 'asc' },
    include: { category: true },
  });
}

// Active field count per campus, used to prioritize campuses that have already been
// configured over ones still using the (soon to be cleaned up) default assignment.
export async function getCampusPopulationCategoryCounts() {
  const counts = await prisma.campusPopulationCategory.groupBy({
    by: ['campus_id'],
    where: { is_active: true },
    _count: { _all: true },
  });
  return counts.map((c) => ({ campus_id: c.campus_id, count: c._count._all }));
}

export async function addCampusPopulationCategory(campusId: string, categoryId: string) {
  const maxSort = await prisma.campusPopulationCategory.aggregate({
    where: { campus_id: campusId },
    _max: { sort_order: true },
  });
  const link = await prisma.campusPopulationCategory.upsert({
    where: { campus_id_category_id: { campus_id: campusId, category_id: categoryId } },
    update: { is_active: true },
    create: {
      campus_id: campusId,
      category_id: categoryId,
      sort_order: (maxSort._max.sort_order ?? -1) + 1,
    },
  });
  revalidatePopulationFields();
  return link;
}

// Soft-remove only: a report may already reference this category through
// report_population_counts, so the assignment is deactivated, never deleted.
export async function updateCampusPopulationCategory(
  id: string,
  data: Partial<{ is_required: boolean; is_active: boolean; sort_order: number }>
) {
  const link = await prisma.campusPopulationCategory.update({ where: { id }, data });
  revalidatePopulationFields();
  return link;
}

// Hard delete of the assignment row itself, for correcting mis-seeded campus data.
// The category and any report history remain untouched (the FK is on population_categories).
export async function deleteCampusPopulationCategory(id: string) {
  await prisma.campusPopulationCategory.delete({ where: { id } });
  revalidatePopulationFields();
}

export async function reorderCampusPopulationCategories(orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.campusPopulationCategory.update({ where: { id }, data: { sort_order: index } })
    )
  );
  revalidatePopulationFields();
}
