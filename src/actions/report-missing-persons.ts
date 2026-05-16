'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getReportMissingPersons(reportId: string) {
  return prisma.reportMissingPerson.findMany({
    where: { report_id: reportId },
    orderBy: { created_at: 'asc' },
  });
}

export async function createReportMissingPerson(data: { report_id: string; name: string }) {
  const result = await prisma.reportMissingPerson.create({ data });
  revalidatePath('/reports');
  return result;
}

export async function deleteReportMissingPerson(id: string) {
  await prisma.reportMissingPerson.delete({ where: { id } });
  revalidatePath('/reports');
}
