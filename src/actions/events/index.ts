'use server';

import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

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
    orderBy: { created_at: 'desc' },
  });
}

export async function getEvent(id: string) {
  return prisma.event.findUnique({
    where: { id: id },
    include: {
      status: { select: { name: true } },
      campus: { select: { name: true } },
    },
  });
}

export async function createEvent(data: Prisma.EventCreateInput) {
  try {
    const event = await prisma.event.create({ data });
    revalidatePath('/events');
    return event;
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
    revalidatePath('/events');
    revalidatePath(`/events/details`);
    return event;
  } catch (err) {
    throw toFriendlyError(err, 'event');
  }
}

export async function deleteEvent(id: string) {
  try {
    await prisma.event.delete({ where: { id: id } });
    revalidatePath('/events');
  } catch (err) {
    throw toFriendlyError(err, 'event');
  }
}

export async function getOngoingEvents(campusId: string) {
  const statusRow = await prisma.eventStatus.findFirst({
    where: { name: { equals: 'Ongoing', mode: 'insensitive' } },
    select: { id: true },
  });

  if (!statusRow) return [];

  return prisma.event.findMany({
    where: { status_id: statusRow.id, campus_id: campusId },
    select: {
      id: true,
      name: true,
      quarter: true,
      started_at: true,
    },
    orderBy: { started_at: 'desc' },
  });
}
