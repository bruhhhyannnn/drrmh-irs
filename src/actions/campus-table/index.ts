'use server';

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getCampuses(query?: string) {
  return prisma.cluster.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}

export async function getCampus(id: string) {
  return prisma.campus.findUnique({
    where: { id: id },
  });
}

export async function createCampus(data: Prisma.campusCreateInput) {
  const campus = await prisma.campus.create({ data });
  revalidatePath('/campus');
  return campus;
}

export async function updateCampus(id: string, data: Prisma.campusUpdateInput) {
  const campus = await prisma.campus.update({ where: { id }, data });
  revalidatePath('/campus');
  revalidatePath('/campus/details');
  return campus;
}

export async function deleteCampus(id: string) {
  await prisma.campus.delete({ where: { id } });
  revalidatePath('/campus');
}
