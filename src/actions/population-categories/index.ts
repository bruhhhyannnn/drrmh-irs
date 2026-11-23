'use server';

import { inScope } from '@/lib/admin-scope';
import { canEditPopulationField } from '@/lib/population-field-access';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import {
  campusPopulationLinkUpdateSchema,
  populationCategoryCreateSchema,
  populationCategoryUpdateSchema,
} from '@/lib/schemas';
import { requireAdmin } from '@/lib/server-auth';
import { isUuid, type ActionRefusal } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// The lists stay readable (the report and QR forms show a campus's fields). Every write checks
// its caller (#102): an admin, and only for a campus their scope covers. Payloads are strict
// allowlists, so no nested write rides along.

const ADMIN_ONLY: ActionRefusal = {
  ok: false,
  error: 'Sign in as an administrator to change headcount fields.',
  retry: false,
};
const NOT_FOUND: ActionRefusal = {
  ok: false,
  error: 'This field could not be found. Refresh the page.',
  retry: false,
};
const refuse = (error: string): ActionRefusal => ({ ok: false, error, retry: false });
const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? 'Check the field.';

/** A campus's field link, if this admin's scope covers its campus. */
async function linkInScope(scope: Parameters<typeof inScope>[0], id: unknown) {
  if (!isUuid(id)) return null;
  const link = await prisma.campusPopulationCategory.findUnique({
    where: { id },
    select: { id: true, campus_id: true },
  });
  return link && inScope(scope, link.campus_id) ? link : null;
}

/**
 * How much other campuses use a field: their links to it, and their reports' and bystander
 * reports' headcounts for it (scoped by the report's campus; the caller's own is left out).
 */
async function fieldUseElsewhere(categoryId: string, campusId: string) {
  const [linkedElsewhere, reportedElsewhere, bystanderElsewhere] = await Promise.all([
    prisma.campusPopulationCategory.count({
      where: { category_id: categoryId, campus_id: { not: campusId } },
    }),
    prisma.reportPopulationCount.count({
      where: { category_id: categoryId, report: { event: { campus_id: { not: campusId } } } },
    }),
    prisma.bystanderReportPopulationCount.count({
      where: {
        category_id: categoryId,
        bystander_report: { clusters: { campus_id: { not: campusId } } },
      },
    }),
  ]);
  return { linkedElsewhere, reportedElsewhere: reportedElsewhere + bystanderElsewhere };
}

function revalidatePopulationFields() {
  revalidatePath('/settings/population-fields');
}

/* ─── Category catalog (site-wide) ─── */

export async function getPopulationCategories() {
  return prisma.populationCategory.findMany({ orderBy: { name: 'asc' } });
}

type CategoryResult =
  | { ok: true; category: Awaited<ReturnType<typeof prisma.populationCategory.create>> }
  | ActionRefusal;

/** A new field name, made when an admin adds one their campus doesn't have yet. */
export async function createPopulationCategory(
  token: string | null,
  data: { code: string; name: string; description?: string; is_active?: boolean }
): Promise<CategoryResult> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  const parsed = populationCategoryCreateSchema.safeParse(data);
  if (!parsed.success) return refuse(firstIssue(parsed.error));
  try {
    const category = await prisma.populationCategory.create({ data: parsed.data });
    revalidatePopulationFields();
    return { ok: true, category };
  } catch (err) {
    return refuse(toFriendlyError(err, 'population category').message);
  }
}

/**
 * Edit field. It is shared by every campus that uses it, so an Administrator may edit one only
 * while no other campus links to it or has reported a headcount for it (owner decision on #102);
 * a Super Admin, any.
 */
export async function updatePopulationCategory(
  token: string | null,
  id: string,
  data: Partial<{ name: string; description: string; is_active: boolean }>
): Promise<CategoryResult> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  if (!isUuid(id)) return NOT_FOUND;
  const parsed = populationCategoryUpdateSchema.safeParse(data);
  if (!parsed.success) return refuse(firstIssue(parsed.error));
  try {
    if (caller.scope.role !== 'super_admin') {
      const campusId = caller.scope.campusId;
      if (!campusId) return ADMIN_ONLY;
      const use = await fieldUseElsewhere(id, campusId);
      if (!canEditPopulationField(caller.scope, use)) {
        return refuse(
          'Another campus uses this field, or has reports with it. Ask a super admin to change it.'
        );
      }
    }
    const category = await prisma.populationCategory.update({ where: { id }, data: parsed.data });
    revalidatePopulationFields();
    return { ok: true, category };
  } catch (err) {
    return refuse(toFriendlyError(err, 'population category').message);
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

/**
 * Adds a field to a campus (or turns its link back on), at the end of the list. The campus row is
 * locked while the next place is picked, so two added at once don't share one (#108).
 */
export async function addCampusPopulationCategory(
  token: string | null,
  campusId: string,
  categoryId: string
): Promise<{ ok: true } | ActionRefusal> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  if (!isUuid(campusId) || !isUuid(categoryId) || !inScope(caller.scope, campusId)) {
    return refuse("You can't change that campus's fields.");
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campus WHERE id = ${campusId}::uuid FOR UPDATE`;
      const maxSort = await tx.campusPopulationCategory.aggregate({
        where: { campus_id: campusId },
        _max: { sort_order: true },
      });
      await tx.campusPopulationCategory.upsert({
        where: { campus_id_category_id: { campus_id: campusId, category_id: categoryId } },
        update: { is_active: true },
        create: {
          campus_id: campusId,
          category_id: categoryId,
          sort_order: (maxSort._max.sort_order ?? -1) + 1,
        },
      });
    });
    revalidatePopulationFields();
    return { ok: true };
  } catch (err) {
    return refuse(toFriendlyError(err, 'population category').message);
  }
}

// Soft-remove only: a report may already reference this category through
// report_population_counts, so the assignment is deactivated, never deleted.
export async function updateCampusPopulationCategory(
  token: string | null,
  id: string,
  data: Partial<{ is_required: boolean; is_active: boolean; sort_order: number }>
): Promise<{ ok: true } | ActionRefusal> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  const parsed = campusPopulationLinkUpdateSchema.safeParse(data);
  if (!parsed.success) return refuse(firstIssue(parsed.error));
  if (!(await linkInScope(caller.scope, id))) return NOT_FOUND;
  try {
    await prisma.campusPopulationCategory.update({ where: { id }, data: parsed.data });
    revalidatePopulationFields();
    return { ok: true };
  } catch (err) {
    return refuse(toFriendlyError(err, 'population category').message);
  }
}

// Hard delete of the assignment row itself, for correcting mis-seeded campus data.
// The category and any report history remain untouched (the FK is on population_categories).
export async function deleteCampusPopulationCategory(
  token: string | null,
  id: string
): Promise<{ ok: true } | ActionRefusal> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  if (!(await linkInScope(caller.scope, id))) return NOT_FOUND;
  try {
    await prisma.campusPopulationCategory.delete({ where: { id } });
    revalidatePopulationFields();
    return { ok: true };
  } catch (err) {
    return refuse(toFriendlyError(err, 'population category').message);
  }
}

/** The most fields one reorder may carry. */
const MAX_FIELDS = 100;

/** Saves a campus's field order. Every id must be a link of one campus in the caller's scope. */
export async function reorderCampusPopulationCategories(
  token: string | null,
  orderedIds: string[]
): Promise<{ ok: true } | ActionRefusal> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  const ids = z.array(z.string().uuid()).min(1).max(MAX_FIELDS).safeParse(orderedIds);
  if (!ids.success || new Set(ids.data).size !== ids.data.length) return NOT_FOUND;
  const links = await prisma.campusPopulationCategory.findMany({
    where: { id: { in: ids.data } },
    select: { campus_id: true },
  });
  const campuses = new Set(links.map((l) => l.campus_id));
  if (links.length !== ids.data.length || campuses.size !== 1) return NOT_FOUND;
  if (!inScope(caller.scope, [...campuses][0])) return NOT_FOUND;
  try {
    await prisma.$transaction(
      ids.data.map((id, index) =>
        prisma.campusPopulationCategory.update({ where: { id }, data: { sort_order: index } })
      )
    );
    revalidatePopulationFields();
    return { ok: true };
  } catch (err) {
    return refuse(toFriendlyError(err, 'population category').message);
  }
}
