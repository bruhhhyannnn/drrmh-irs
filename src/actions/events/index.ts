'use server';

import { inScope } from '@/lib/admin-scope';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { removeReportPhotos, REPORT_PHOTO_SELECT, reportPhotoPaths } from '@/lib/report-photos';
import { eventWriteSchema, type EventWriteInput } from '@/lib/schemas';
import { requireAdmin, requireProfile } from '@/lib/server-auth';
import { isUuid, type ActionRefusal } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Every action here checks its caller on the server (#102). Admin pages read and change only the
// events of the campus their verified scope covers (an Administrator's own; a Super Admin's pick
// or all), whatever the request names; ERT pages read the ongoing events of their own campus.

const ADMIN_ONLY: ActionRefusal = {
  ok: false,
  error: 'Sign in as an administrator to manage events.',
  retry: false,
};
const NOT_FOUND: ActionRefusal = {
  ok: false,
  error: 'This event could not be found. It may have been removed.',
  retry: false,
};
const refuse = (error: string): ActionRefusal => ({ ok: false, error, retry: false });

/** At most this many campuses or events in one Add event or Complete event. */
const MAX_BATCH = 50;
const idList = z.array(z.string().uuid()).min(1).max(MAX_BATCH);

/** The events an admin may touch, by id; null when any is missing or outside their scope. */
async function eventsInScope(
  scope: Parameters<typeof inScope>[0],
  ids: string[]
): Promise<{ id: string; campus_id: string; status_id: string }[] | null> {
  const events = await prisma.event.findMany({
    where: { id: { in: ids } },
    select: { id: true, campus_id: true, status_id: true },
  });
  if (events.length !== new Set(ids).size) return null;
  return events.every((e) => inScope(scope, e.campus_id)) ? events : null;
}

function revalidateEvents() {
  revalidatePath('/events');
  revalidatePath('/events/details');
  revalidatePath('/dashboard');
}

async function statusId(name: 'ongoing' | 'completed') {
  const status = await prisma.eventStatus.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
    select: { id: true },
  });
  return status?.id ?? null;
}

/** The Events list: the caller's scope only; empty for anyone but an admin. */
export async function getEvents(token: string | null, query?: string, campusId?: string) {
  const caller = await requireAdmin(token, campusId || null);
  if (!caller.ok) return [];
  const scopeCampus = caller.scope.campusId;
  const search = typeof query === 'string' ? query.slice(0, 200) : undefined;
  return prisma.event.findMany({
    where: {
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
      ...(scopeCampus && { campus_id: scopeCampus }),
    },
    include: {
      status: { select: { name: true } },
      campus: { select: { name: true } },
      _count: { select: { reports: true } },
    },
    orderBy: [{ started_at: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
  });
}

/** One event in the caller's scope; null otherwise. */
export async function getEvent(token: string | null, id: string) {
  const caller = await requireAdmin(token);
  if (!caller.ok || !isUuid(id)) return null;
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      status: { select: { name: true } },
      campus: { select: { name: true } },
      completer: { select: { first_name: true, last_name: true } },
      _count: { select: { reports: true } },
    },
  });
  return event && inScope(caller.scope, event.campus_id) ? event : null;
}

/**
 * Add event with several campuses ticked: the same event once per campus, all or nothing. Every
 * campus must be in the caller's scope. The payload is a strict allowlist (#102): the creator is
 * the caller, and when it starts Completed, so is the completer.
 */
export async function createEvents(
  token: string | null,
  data: EventWriteInput,
  campusIds: string[]
): Promise<{ ok: true; events: { id: string }[] } | ActionRefusal> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  const parsed = eventWriteSchema.safeParse(data);
  if (!parsed.success) return refuse(parsed.error.issues[0]?.message ?? 'Check the event.');
  const campuses = idList.safeParse(campusIds);
  if (!campuses.success) return refuse('Pick at least one campus.');
  if (!campuses.data.every((id) => inScope(caller.scope, id))) {
    return refuse("You can't add events for that campus.");
  }
  const completing = parsed.data.status_id === (await statusId('completed'));
  const fields = {
    ...parsed.data,
    ended_at: completing && !parsed.data.ended_at ? new Date() : (parsed.data.ended_at ?? null),
    user_id: caller.profile.id,
    completed_by: completing ? caller.profile.id : null,
  };
  try {
    const events = await prisma.$transaction(
      [...new Set(campuses.data)].map((campus_id) =>
        prisma.event.create({ data: { ...fields, campus_id }, select: { id: true } })
      )
    );
    revalidateEvents();
    return { ok: true, events };
  } catch (err) {
    return refuse(toFriendlyError(err, 'event').message);
  }
}

/**
 * Edit event. The event and its new campus must be in the caller's scope. Who completed it is
 * kept while it stays completed, set to the caller when it becomes completed, and cleared when
 * it is reopened; a newly completed event without an end time ends now.
 */
export async function updateEvent(
  token: string | null,
  id: string,
  data: EventWriteInput & { campus_id: string }
): Promise<{ ok: true } | ActionRefusal> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  if (!isUuid(id)) return NOT_FOUND;
  const { campus_id: campusId, ...rest } = (data ?? {}) as EventWriteInput & { campus_id: string };
  const parsed = eventWriteSchema.safeParse(rest);
  if (!parsed.success) return refuse(parsed.error.issues[0]?.message ?? 'Check the event.');
  if (!isUuid(campusId) || !inScope(caller.scope, campusId)) {
    return refuse("You can't move an event to that campus.");
  }
  const [current] = (await eventsInScope(caller.scope, [id])) ?? [];
  if (!current) return NOT_FOUND;

  const completedId = await statusId('completed');
  const completing = parsed.data.status_id === completedId;
  const wasCompleted = current.status_id === completedId;
  const endedAt = parsed.data.ended_at ?? null;
  try {
    await prisma.event.update({
      where: { id },
      data: {
        ...parsed.data,
        campus_id: campusId,
        ended_at: completing && !wasCompleted && !endedAt ? new Date() : endedAt,
        ...(completing && !wasCompleted
          ? { completed_by: caller.profile.id }
          : !completing && wasCompleted
            ? { completed_by: null }
            : {}),
      },
    });
    revalidateEvents();
    return { ok: true };
  } catch (err) {
    return refuse(toFriendlyError(err, 'event').message);
  }
}

/**
 * Complete event: status Completed, end time now and who did it, for this event and any
 * same-name events at other campuses that were ticked in the dialog.
 */
export async function completeEvents(
  token: string | null,
  ids: string[]
): Promise<{ ok: true; endedAt: Date } | ActionRefusal> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  const parsed = idList.safeParse(ids);
  if (!parsed.success) return NOT_FOUND;
  // Every event must be one this admin may complete; one outside their scope refuses them all.
  if (!(await eventsInScope(caller.scope, parsed.data))) return NOT_FOUND;
  const completedId = await statusId('completed');
  if (!completedId) return refuse('The Completed event status is missing from Settings.');
  try {
    const endedAt = new Date();
    await prisma.event.updateMany({
      where: { id: { in: parsed.data } },
      data: { status_id: completedId, ended_at: endedAt, completed_by: caller.profile.id },
    });
    revalidateEvents();
    return { ok: true, endedAt };
  } catch (err) {
    return refuse(toFriendlyError(err, 'event').message);
  }
}

/**
 * Deletes the event; its reports cascade, so their photos are deleted after it. The event and
 * its reports are locked first, so no report or casualty is added between reading the photos
 * and the delete.
 */
export async function deleteEvent(
  token: string | null,
  id: string
): Promise<{ ok: true } | ActionRefusal> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  if (!isUuid(id) || !(await eventsInScope(caller.scope, [id]))) return NOT_FOUND;
  try {
    const photoPaths = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM events WHERE id = ${id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM reports WHERE event_id = ${id}::uuid FOR UPDATE`;
      const reports = await tx.report.findMany({
        where: { event_id: id },
        select: REPORT_PHOTO_SELECT,
      });
      await tx.event.delete({ where: { id: id } });
      return reportPhotoPaths(reports);
    });
    await removeReportPhotos(photoPaths);
    revalidateEvents();
    return { ok: true };
  } catch (err) {
    return refuse(toFriendlyError(err, 'event').message);
  }
}

/**
 * Ongoing events for the ERT pages: a member's own campus, whatever is asked; an admin's scope.
 */
export async function getOngoingEvents(token: string | null, requestedCampusId: string) {
  const caller = await requireProfile(token);
  if (!caller.ok) return [];
  const admin = await requireAdmin(token, requestedCampusId || null);
  const campusId = admin.ok ? admin.scope.campusId : caller.profile.campus_id;
  if (!campusId) return [];
  const ongoingId = await statusId('ongoing');
  if (!ongoingId) return [];

  return prisma.event.findMany({
    where: { status_id: ongoingId, campus_id: campusId },
    select: {
      id: true,
      name: true,
      quarter: true,
      started_at: true,
    },
    orderBy: { started_at: 'desc' },
  });
}

/** Ongoing events in scope for Add report: one campus, or every campus (admins only). */
export async function getOngoingEventOptions(token: string | null, campusId?: string) {
  const caller = await requireAdmin(token, campusId || null);
  if (!caller.ok) return [];
  const scopeCampus = caller.scope.campusId;
  const ongoingId = await statusId('ongoing');
  if (!ongoingId) return [];
  return prisma.event.findMany({
    where: { status_id: ongoingId, ...(scopeCampus && { campus_id: scopeCampus }) },
    select: { id: true, name: true, campus_id: true, campus: { select: { name: true } } },
    orderBy: { started_at: 'desc' },
  });
}

/** The same event (by name) still ongoing at other campuses — offered in Complete event. */
export async function getSiblingOngoingEvents(token: string | null, eventId: string) {
  const caller = await requireAdmin(token);
  if (!caller.ok || !isUuid(eventId)) return [];
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true, campus_id: true },
  });
  const ongoingId = await statusId('ongoing');
  if (!event || !ongoingId || !inScope(caller.scope, event.campus_id)) return [];
  // Only a Super Admin (all campuses) completes other campuses' events.
  if (caller.scope.campusId !== null) return [];
  return prisma.event.findMany({
    where: {
      name: event.name,
      status_id: ongoingId,
      id: { not: eventId },
      campus_id: { not: event.campus_id },
    },
    select: { id: true, campus: { select: { name: true } } },
    orderBy: { campus: { name: 'asc' } },
  });
}

/** Every other event at the same campus, newest first — the Compare with menu. */
export async function getCampusEventOptions(token: string | null, campusId: string) {
  const caller = await requireAdmin(token);
  if (!caller.ok || !isUuid(campusId) || !inScope(caller.scope, campusId)) return [];
  return prisma.event.findMany({
    where: { campus_id: campusId },
    select: {
      id: true,
      name: true,
      started_at: true,
      ended_at: true,
      status: { select: { name: true } },
    },
    orderBy: [{ started_at: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
  });
}

/**
 * Everything the event summary is built from (campus details, event details and the report
 * PDF): the event, its reports, the campus's active clusters and population fields.
 */
export async function getEventSummarySource(token: string | null, eventId: string) {
  // Admins only, and only an event in their scope (#102): it holds casualties' names, ages and
  // diagnoses. Null, as for a missing event, otherwise.
  const caller = await requireAdmin(token);
  if (!caller.ok || !isUuid(eventId)) return null;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      description: true,
      quarter: true,
      started_at: true,
      ended_at: true,
      campus_id: true,
      campus: { select: { name: true } },
      status: { select: { name: true } },
      completer: { select: { first_name: true, last_name: true } },
    },
  });
  if (!event || !inScope(caller.scope, event.campus_id)) return null;

  const [reports, clusters, fields] = await Promise.all([
    prisma.report.findMany({
      where: { event_id: eventId },
      orderBy: { submitted_at: 'asc' },
      select: {
        id: true,
        submitted_at: true,
        cluster_id: true,
        unit_id: true,
        cluster: { select: { name: true } },
        unit: { select: { name: true } },
        user: { select: { first_name: true, last_name: true } },
        damage_conditions: { select: { name: true } },
        population_counts: {
          select: { count: true, category: { select: { id: true, name: true } } },
        },
        casualties: {
          select: {
            id: true,
            name: true,
            age: true,
            sex: true,
            diagnosis: true,
            condition: { select: { name: true } },
          },
        },
        missing_persons: { select: { id: true, name: true, age: true, sex: true } },
      },
    }),
    prisma.cluster.findMany({
      where: { campus_id: event.campus_id, is_active: true },
      select: {
        id: true,
        name: true,
        units: {
          where: { is_active: true },
          select: { id: true, name: true, created_at: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.campusPopulationCategory.findMany({
      where: { campus_id: event.campus_id, is_active: true },
      orderBy: { sort_order: 'asc' },
      select: { category: { select: { id: true, name: true } } },
    }),
  ]);

  return { event, reports, clusters, fields: fields.map((f) => f.category) };
}
