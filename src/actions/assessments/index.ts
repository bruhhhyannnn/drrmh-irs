'use server';

import { checkAssessmentCaller } from '@/lib/assessment-caller';
import { loadAssessmentRecord, loadVersion } from '@/lib/assessment-records';
import { prepareAssessmentWrite } from '@/lib/assessment-score';
import {
  PILLAR_CODES,
  type AssessmentRecord,
  type AssessmentSetup,
  type AssessmentTemplate,
  type CreateAssessmentResult,
  type MyAssessmentRow,
} from '@/lib/assessment-template';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { assessmentPayloadSchema, type AssessmentPayload } from '@/lib/schemas';
import { requireProfile } from '@/lib/server-auth';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// The building assessment (DRRM-015). Writes and the caller's own reads take the Supabase access
// token and check it on the server (src/lib/server-auth.ts); the evaluator is always the token's
// profile. Expected failures come back as { ok: false, error, retry } because a thrown message is
// hidden in production, and the offline queue needs `retry` to know whether to keep the entry.

const isUuid = (value: unknown): value is string => z.string().uuid().safeParse(value).success;

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/* ─── Templates ─── */

/** The version new assessments use. */
export async function getPublishedTemplate(): Promise<AssessmentTemplate | null> {
  return (await loadVersion({ status: 'published' }))?.template ?? null;
}

/** A non-draft version by id: a draft on the phone may have been started on one that has since
 * changed. Unpublished (draft) versions stay with the admin checklist editor. */
export async function getTemplateVersion(
  token: string | null,
  versionId: string
): Promise<AssessmentTemplate | null> {
  if (!isUuid(versionId)) return null;
  const caller = await requireProfile(token);
  if (!caller.ok) return null;
  return (await loadVersion({ id: versionId, status: { not: 'draft' } }))?.template ?? null;
}

/* ─── Form setup ─── */

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** The caller's own campus only; empty for any other campus or an unverified caller. */
export async function getAssessmentSetup(
  token: string | null,
  campusId: string
): Promise<AssessmentSetup> {
  const none: AssessmentSetup = { clusters: [], buildings: [], events: [] };
  if (!isUuid(campusId)) return none;
  const caller = await requireProfile(token);
  if (!caller.ok || caller.profile.campus_id !== campusId) return none;

  const statusIs = (name: string): Prisma.EventWhereInput => ({
    status: { name: { equals: name, mode: 'insensitive' } },
  });
  const [clusters, buildings, events] = await Promise.all([
    prisma.cluster.findMany({
      where: { campus_id: campusId, is_active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        units: {
          where: { is_active: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        },
      },
    }),
    prisma.building.findMany({
      where: { is_active: true, unit: { cluster: { campus_id: campusId } } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        unit_id: true,
        name: true,
        floor_count: true,
        areas: { select: { area_type_id: true } },
        assessments: { orderBy: { ended_at: 'desc' }, take: 1, select: { ended_at: true } },
      },
    }),
    prisma.event.findMany({
      where: {
        campus_id: campusId,
        OR: [
          statusIs('ongoing'),
          { ...statusIs('completed'), ended_at: { gte: new Date(Date.now() - THIRTY_DAYS_MS) } },
        ],
      },
      orderBy: [{ started_at: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
      select: { id: true, name: true, status: { select: { name: true } } },
    }),
  ]);

  return {
    clusters,
    buildings: buildings.map((b) => ({
      id: b.id,
      unit_id: b.unit_id,
      name: b.name,
      floor_count: b.floor_count,
      area_type_ids: b.areas.map((a) => a.area_type_id),
      last_assessed_at: b.assessments[0]?.ended_at.toISOString() ?? null,
    })),
    events: events.map((e) => ({ id: e.id, name: e.name, status: e.status.name })),
  };
}

/* ─── Submit ─── */

const fail = (error: string): CreateAssessmentResult => ({ ok: false, error, retry: false });

async function findByClientRef(clientRef: string) {
  const found = await prisma.assessment.findUnique({
    where: { client_ref: clientRef },
    select: { id: true },
  });
  return found?.id ?? null;
}

/** The building's id, or null when it isn't available to this campus. New ones are created. */
async function resolveBuilding(
  building: AssessmentPayload['building'],
  campusId: string,
  userId: string
): Promise<string | null> {
  if ('id' in building) {
    const found = await prisma.building.findFirst({
      where: { id: building.id, is_active: true, unit: { cluster: { campus_id: campusId } } },
      select: { id: true },
    });
    return found?.id ?? null;
  }

  const { unit_id, name } = building.new;
  const unit = await prisma.unit.findFirst({
    where: { id: unit_id, is_active: true, cluster: { campus_id: campusId } },
    select: { id: true },
  });
  if (!unit) return null;

  // Same name in the same unit, ignoring case (uq_buildings_unit_name is on lower(name)).
  const findSameName = async () => {
    const siblings = await prisma.building.findMany({
      where: { unit_id },
      select: { id: true, name: true, is_active: true },
    });
    return siblings.find((b) => b.name.toLowerCase() === name.toLowerCase()) ?? null;
  };
  const existing = await findSameName();
  if (existing) return existing.is_active ? existing.id : null;
  try {
    const created = await prisma.building.create({
      data: { unit_id, name, created_by: userId },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const again = await findSameName();
    return again?.is_active ? again.id : null;
  }
}

export async function createAssessment(
  token: string | null,
  payload: AssessmentPayload
): Promise<CreateAssessmentResult> {
  // Another account signed in on a shared phone answers `retry`, never a refusal (see
  // assessment-caller.ts), so the owner's queued entry isn't lost.
  const caller = checkAssessmentCaller(await requireProfile(token), payload?.evaluator_id);
  if (!caller.ok) return caller;
  const { profile, campusId } = caller;

  const parsed = assessmentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? 'This assessment is incomplete.');
  }
  const data = parsed.data;

  try {
    const already = await findByClientRef(data.client_ref);
    if (already) return { ok: true, id: already };

    const version = await loadVersion({ id: data.template_version_id });
    if (!version || version.status === 'draft') {
      return fail("This checklist version can't take new assessments.");
    }

    const areaTypeIds = [...new Set(data.area_type_ids)];
    const knownAreas = await prisma.buildingAreaType.count({ where: { id: { in: areaTypeIds } } });
    if (knownAreas !== areaTypeIds.length) {
      return fail('Some of the areas ticked are no longer in the checklist.');
    }

    const prepared = prepareAssessmentWrite(version.template, {
      floor_count: data.floor_count,
      area_type_ids: areaTypeIds,
      answers: data.answers,
      comments: data.comments,
    });
    if (prepared.missing > 0) {
      return fail(
        prepared.missing === 1
          ? '1 question still needs an answer.'
          : `${prepared.missing} questions still need an answer.`
      );
    }

    const buildingId = await resolveBuilding(data.building, campusId, profile.id);
    if (!buildingId) return fail('That building is no longer available.');

    const event = data.event_id
      ? await prisma.event.findFirst({
          where: { id: data.event_id, campus_id: campusId },
          select: { id: true },
        })
      : null;

    const pillars = await prisma.drrmPillar.findMany({ select: { id: true, code: true } });
    const pillarScores = PILLAR_CODES.map((code) => {
      const pillar = pillars.find((p) => p.code === code);
      if (!pillar) throw new Error('The checklist is not fully set up yet.');
      const tally = prepared.pillarTallies[code];
      return {
        pillar_id: pillar.id,
        safe_count: tally.safe,
        counted_count: tally.counted,
        na_count: tally.na,
      };
    });

    const id = await prisma.$transaction(async (tx) => {
      const created = await tx.assessment.create({
        data: {
          client_ref: data.client_ref,
          template_version_id: version.template.version_id,
          building_id: buildingId,
          event_id: event?.id ?? null,
          evaluator_id: profile.id,
          incident_commander: data.incident_commander,
          floor_count: data.floor_count,
          started_at: new Date(data.started_at),
          ended_at: new Date(data.ended_at),
          needs_follow_up: prepared.needsFollowUp,
          areas: { createMany: { data: areaTypeIds.map((area_type_id) => ({ area_type_id })) } },
          answers: { createMany: { data: prepared.answers } },
          comments: { createMany: { data: prepared.comments } },
          pillar_scores: { createMany: { data: pillarScores } },
        },
        select: { id: true },
      });
      // The building's profile is what this assessment found, for pre-filling the next one.
      await tx.buildingArea.deleteMany({ where: { building_id: buildingId } });
      await tx.buildingArea.createMany({
        data: areaTypeIds.map((area_type_id) => ({ building_id: buildingId, area_type_id })),
      });
      await tx.building.update({
        where: { id: buildingId },
        data: { floor_count: data.floor_count },
      });
      return created.id;
    });

    revalidatePath('/assessments');
    return { ok: true, id };
  } catch (err) {
    // A replay of the same draft that landed in between: it's already saved.
    if (isUniqueViolation(err)) {
      const existing = await findByClientRef(data.client_ref);
      if (existing) return { ok: true, id: existing };
    }
    throw toFriendlyError(err, 'assessment');
  }
}

/* ─── The caller's own assessments ─── */

/** Newest first, the last 50. [] when the caller can't be verified. */
export async function getMyAssessments(token: string | null): Promise<MyAssessmentRow[]> {
  const caller = await requireProfile(token);
  if (!caller.ok) return [];

  const rows = await prisma.assessment.findMany({
    where: { evaluator_id: caller.profile.id },
    orderBy: { ended_at: 'desc' },
    take: 50,
    select: {
      id: true,
      ended_at: true,
      needs_follow_up: true,
      building: { select: { name: true, unit: { select: { name: true } } } },
      pillar_scores: { select: { safe_count: true, counted_count: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    building_name: r.building.name,
    unit_name: r.building.unit.name,
    ended_at: r.ended_at.toISOString(),
    safe: r.pillar_scores.reduce((n, p) => n + p.safe_count, 0),
    counted: r.pillar_scores.reduce((n, p) => n + p.counted_count, 0),
    needs_follow_up: r.needs_follow_up,
  }));
}

/** One of the caller's own assessments, with the template version it was answered with. */
export async function getMyAssessment(
  token: string | null,
  id: string
): Promise<AssessmentRecord | null> {
  if (!isUuid(id)) return null;
  const caller = await requireProfile(token);
  if (!caller.ok) return null;

  return loadAssessmentRecord({ id, evaluator_id: caller.profile.id });
}
