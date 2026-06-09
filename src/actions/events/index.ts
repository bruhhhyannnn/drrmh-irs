'use server';

import { eventSchema, type EventFormData } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireStaff } from '@/lib/server-auth';
import { revalidatePath } from 'next/cache';

function normalizeEventInput(data: EventFormData) {
  const parsed = eventSchema.parse(data);
  return {
    name: parsed.name.trim(),
    description: parsed.description?.trim() || null,
    quarter: parsed.quarter?.trim() || null,
    started_at: parsed.started_at ? new Date(parsed.started_at) : null,
    ended_at: parsed.ended_at ? new Date(parsed.ended_at) : null,
    location_id: parsed.location_id || null,
    status_id: parsed.status_id,
  };
}

export async function getEvents(query?: string) {
  await requireAdmin();
  const safeQuery = query?.trim().slice(0, 100);

  return prisma.event.findMany({
    where: safeQuery ? { name: { contains: safeQuery, mode: 'insensitive' } } : undefined,
    include: {
      location: { select: { name: true } },
      status: { select: { name: true } },
      _count: { select: { reports: true } },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getEvent(id: string) {
  await requireAdmin();
  return prisma.event.findUnique({
    where: { id },
    include: {
      location: { select: { name: true } },
      status: { select: { name: true } },
    },
  });
}

export async function createEvent(data: EventFormData) {
  const currentUser = await requireAdmin();
  const parsed = normalizeEventInput(data);

  const event = await prisma.event.create({
    data: { ...parsed, user_id: currentUser.id },
  });
  revalidatePath('/events');
  return event;
}

export async function updateEvent(id: string, data: EventFormData) {
  await requireAdmin();
  const parsed = normalizeEventInput(data);

  const event = await prisma.event.update({
    where: { id },
    data: parsed,
  });
  revalidatePath('/events');
  revalidatePath('/events/details');
  return event;
}

export async function deleteEvent(id: string) {
  await requireAdmin();
  await prisma.event.delete({ where: { id } });
  revalidatePath('/events');
}

export async function getOngoingEvents() {
  await requireStaff();

  const statusRow = await prisma.eventStatus.findFirst({
    where: { name: { equals: 'Ongoing', mode: 'insensitive' } },
    select: { id: true },
  });

  if (!statusRow) return [];

  return prisma.event.findMany({
    where: { status_id: statusRow.id },
    select: {
      id: true,
      name: true,
      description: true,
      quarter: true,
      started_at: true,
      ended_at: true,
      status: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
    orderBy: { started_at: 'desc' },
  });
}
