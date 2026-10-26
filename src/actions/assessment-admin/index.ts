'use server';

import { inScope } from '@/lib/admin-scope';
import {
  loadAssessmentRecord,
  loadBuildingScores,
  scoredInclude,
  toScoredAssessment,
} from '@/lib/assessment-records';
import type {
  AdminAssessmentRow,
  AssessmentRecord,
  BuildingScores,
} from '@/lib/assessment-template';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { requireAdmin } from '@/lib/server-auth';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Building assessments for the admin pages (DRRM-015 Phase 2). Every read takes the caller's
// access token and gets its campus from requireAdmin: an Administrator only ever sees their own
// campus, whatever `campusId` says; a Super Admin sees the one asked for, or all (null).

const isUuid = (value: unknown): value is string => z.string().uuid().safeParse(value).success;

/** How many submissions the Assessments tab loads; it filters and pages on the client. */
const LIST_LIMIT = 1000;

const inCampus = (campusId: string | null): Prisma.BuildingWhereInput =>
  campusId ? { unit: { cluster: { campus_id: campusId } } } : {};

/** Every submission in scope, newest first. [] when the caller isn't an admin. */
export async function getAssessmentList(
  token: string | null,
  campusId?: string | null
): Promise<AdminAssessmentRow[]> {
  const caller = await requireAdmin(token, campusId);
  if (!caller.ok) return [];

  const rows = await prisma.assessment.findMany({
    where: { building: inCampus(caller.scope.campusId) },
    orderBy: { ended_at: 'desc' },
    take: LIST_LIMIT,
    select: {
      id: true,
      ended_at: true,
      needs_follow_up: true,
      ...scoredInclude,
      building: {
        select: {
          id: true,
          name: true,
          unit: {
            select: {
              id: true,
              name: true,
              cluster: {
                select: { id: true, name: true, campus: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });
  return rows.map((r) => {
    const scored = toScoredAssessment(r);
    return {
      id: r.id,
      building: { id: r.building.id, name: r.building.name },
      unit: { id: r.building.unit.id, name: r.building.unit.name },
      cluster: { id: r.building.unit.cluster.id, name: r.building.unit.cluster.name },
      campus: r.building.unit.cluster.campus,
      evaluator_name: scored.evaluator_name,
      event_name: scored.event_name,
      ended_at: scored.ended_at,
      overall: scored.overall,
      needs_follow_up: r.needs_follow_up,
    };
  });
}

/** Active buildings in scope with their latest two assessments. [] when not an admin. */
export async function getBuildingSummaries(
  token: string | null,
  campusId?: string | null
): Promise<BuildingScores[]> {
  const caller = await requireAdmin(token, campusId);
  if (!caller.ok) return [];
  return loadBuildingScores({ is_active: true, ...inCampus(caller.scope.campusId) });
}

/** Any assessment in the caller's scope; null when refused, missing or at another campus. */
export async function getAssessment(
  token: string | null,
  id: string
): Promise<AssessmentRecord | null> {
  if (!isUuid(id)) return null;
  const caller = await requireAdmin(token);
  if (!caller.ok) return null;
  const record = await loadAssessmentRecord({ id });
  if (!record || !inScope(caller.scope, record.campus_id)) return null;
  return record;
}

/** Super Admin only: the assessment with its areas, answers, pillar scores and comments. */
export async function deleteAssessment(
  token: string | null,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const caller = await requireAdmin(token);
  if (!caller.ok || caller.scope.role !== 'super_admin') {
    return { ok: false, error: 'Only a super admin can delete an assessment.' };
  }
  if (!isUuid(id)) return { ok: false, error: 'This assessment could not be found.' };
  try {
    await prisma.assessment.delete({ where: { id } });
  } catch (err) {
    return { ok: false, error: toFriendlyError(err, 'assessment').message };
  }
  revalidatePath('/assessments');
  revalidatePath('/dashboard');
  return { ok: true };
}
