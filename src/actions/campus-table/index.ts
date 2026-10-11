'use server';

import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

/** Events, users, clusters and active population fields per campus. */
const CAMPUS_COUNTS = {
  _count: {
    select: {
      events: true,
      users: true,
      clusters: true,
      population_categories: { where: { is_active: true } },
    },
  },
} satisfies Prisma.campusInclude;

export async function getCampuses() {
  return prisma.campus.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getCampus(id: string) {
  return prisma.campus.findUnique({
    where: { id: id },
  });
}

/** The Campus page: every campus with what is linked to it. */
export async function getCampusesOverview() {
  return prisma.campus.findMany({ include: CAMPUS_COUNTS, orderBy: { name: 'asc' } });
}

export async function getCampusOverview(id: string) {
  return prisma.campus.findUnique({ where: { id }, include: CAMPUS_COUNTS });
}

export async function createCampus(data: Prisma.campusCreateInput) {
  try {
    const campus = await prisma.campus.create({ data });
    revalidatePath('/campus');
    return campus;
  } catch (err) {
    throw toFriendlyError(err, 'campus');
  }
}

export async function updateCampus(id: string, data: Prisma.campusUpdateInput) {
  try {
    const campus = await prisma.campus.update({ where: { id }, data });
    revalidatePath('/campus');
    revalidatePath('/campus/details');
    return campus;
  } catch (err) {
    throw toFriendlyError(err, 'campus');
  }
}

export async function deleteCampus(id: string) {
  try {
    await prisma.campus.delete({ where: { id } });
    revalidatePath('/campus');
  } catch (err) {
    throw toFriendlyError(err, 'campus');
  }
}

export async function getCampusClusters(campusId: string) {
  return await prisma.cluster.findMany({
    where: { campus_id: campusId },
    select: { id: true, name: true, is_active: true },
    orderBy: { name: 'asc' },
  });
}
