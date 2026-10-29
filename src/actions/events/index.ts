'use server';

import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { removeReportPhotos, reportPhotoPaths } from '@/lib/report-photos';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

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

export async function getEvents(query?: string, campusId?: string) {
  return prisma.event.findMany({
    where: {
      ...(query && { name: { contains: query, mode: 'insensitive' } }),
      ...(campusId && { campus_id: campusId }),
    },
    include: {
      status: { select: { name: true } },
      campus: { select: { name: true } },
      _count: { select: { reports: true } },
    },
    orderBy: [{ started_at: { sort: 'desc', nulls: 'last' } }, { created_at: 'desc' }],
  });
}

export async function getEvent(id: string) {
  return prisma.event.findUnique({
    where: { id: id },
    include: {
      status: { select: { name: true } },
      campus: { select: { name: true } },
      completer: { select: { first_name: true, last_name: true } },
      _count: { select: { reports: true } },
    },
  });
}

/** Add event with several campuses ticked: the same event once per campus, all or nothing. */
export async function createEvents(
  data: Omit<Prisma.EventUncheckedCreateInput, 'campus_id'>,
  campusIds: string[]
) {
  if (!campusIds.length) throw new Error('Pick at least one campus.');
  try {
    const events = await prisma.$transaction(
      campusIds.map((campus_id) => prisma.event.create({ data: { ...data, campus_id } }))
    );
    revalidateEvents();
    return events;
  } catch (err) {
    throw toFriendlyError(err, 'event');
  }
}

export async function updateEvent(id: string, data: Prisma.EventUpdateInput) {
  try {
    const event = await prisma.event.update({
      where: { id },
      data,
    });
    revalidateEvents();
    return event;
  } catch (err) {
    throw toFriendlyError(err, 'event');
  }
}

/**
 * Complete event: status Completed, end time now and who did it, for this event and any
 * same-name events at other campuses that were ticked in the dialog.
 */
export async function completeEvents(ids: string[], userId: string | null) {
  const completedId = await statusId('completed');
  if (!completedId) throw new Error('The Completed event status is missing from Settings.');
  try {
    const endedAt = new Date();
    await prisma.event.updateMany({
      where: { id: { in: ids } },
      data: { status_id: completedId, ended_at: endedAt, completed_by: userId },
    });
    revalidateEvents();
    return { endedAt };
  } catch (err) {
    throw toFriendlyError(err, 'event');
  }
}

/** Deletes the event; its reports cascade, so their photos are deleted after it. */
export async function deleteEvent(id: string) {
  try {
    const photoPaths = await reportPhotoPaths({ event_id: id });
    await prisma.event.delete({ where: { id: id } });
    await removeReportPhotos(photoPaths);
    revalidateEvents();
  } catch (err) {
    throw toFriendlyError(err, 'event');
  }
}

export async function getOngoingEvents(campusId: string) {
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

/** Ongoing events in scope for Add report: one campus, or every campus. */
export async function getOngoingEventOptions(campusId?: string) {
  const ongoingId = await statusId('ongoing');
  if (!ongoingId) return [];
  return prisma.event.findMany({
    where: { status_id: ongoingId, ...(campusId && { campus_id: campusId }) },
    select: { id: true, name: true, campus_id: true, campus: { select: { name: true } } },
    orderBy: { started_at: 'desc' },
  });
}

/** The same event (by name) still ongoing at other campuses — offered in Complete event. */
export async function getSiblingOngoingEvents(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true, campus_id: true },
  });
  const ongoingId = await statusId('ongoing');
  if (!event || !ongoingId) return [];
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
export async function getCampusEventOptions(campusId: string) {
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
export async function getEventSummarySource(eventId: string) {
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
  if (!event) return null;

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
      select: { id: true, name: true },
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
