'use server';

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getEvents(query?: string) {
  return prisma.event.findMany({
    where: query ? { name: { contains: query, mode: 'insensitive' } } : undefined,
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
  const event = await prisma.event.create({ data });
  revalidatePath('/events');
  return event;
}

export async function updateEvent(id: string, data: Prisma.EventUpdateInput) {
  const event = await prisma.event.update({
    where: { id },
    data,
  });
  revalidatePath('/events');
  revalidatePath(`/events/details`);
  return event;
}

export async function deleteEvent(id: string) {
  await prisma.event.delete({ where: { id: id } });
  revalidatePath('/events');
}

export async function getOngoingEvent(campusId: string) {
  const statusRow = await prisma.eventStatus.findFirst({
    where: { name: { equals: 'Ongoing', mode: 'insensitive' } },
    select: { id: true },
  });

  if (!statusRow) return null;

  return prisma.event.findFirst({
    where: { status_id: statusRow.id, campus_id: campusId },
    select: {
      id: true,
      name: true,
      description: true,
      quarter: true,
      campus: true,
      started_at: true,
      ended_at: true,
      status: { select: { id: true, name: true } },
    },
    orderBy: { started_at: 'desc' },
  });
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
      started_at: true,
    },
    orderBy: { started_at: 'desc' },
  });
}
