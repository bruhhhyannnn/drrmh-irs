'use server';

import { bystanderReportSchema, type BystanderReportFormData } from '@/lib/schemas';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/server-auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const statusUpdateSchema = z.object({
  id: z.string().uuid(),
  statusName: z.enum(['reviewed', 'verified', 'dismissed']),
});

export async function createBystanderReport(data: BystanderReportFormData) {
  const parsed = bystanderReportSchema.parse(data);
  const { report_missing_persons, report_casualties, ...reportData } = parsed;

  const pendingStatus = await prisma.bystander_report_statuses.findFirst({
    where: { name: 'pending' },
  });
  if (!pendingStatus) throw new Error('Pending bystander report status not found.');

  const report = await prisma.bystander_reports.create({
    data: {
      ...reportData,
      unit_id: reportData.unit_id || null,
      damage_condition_id: reportData.damage_condition_id || null,
      status_id: pendingStatus.id,
      ...(report_missing_persons.length && {
        report_missing_persons: {
          create: report_missing_persons.map((p) => ({
            ...p,
            age: p.age ? Number(p.age) : null,
          })),
        },
      }),
      ...(report_casualties.length && {
        report_casualties: {
          create: report_casualties.map((c) => ({
            ...c,
            age: c.age ? Number(c.age) : null,
          })),
        },
      }),
    },
    include: {
      report_missing_persons: true,
      report_casualties: { include: { condition: true } },
      damage_conditions: true,
      bystander_incident_types: true,
      bystander_report_statuses: true,
    },
  });

  return {
    ...report,
    latitude: report.latitude.toNumber(),
    longitude: report.longitude.toNumber(),
  };
}

export async function getBystanderReports() {
  await requireAdmin();

  const reports = await prisma.bystander_reports.findMany({
    include: {
      clusters: true,
      units: true,
      bystander_incident_types: true,
      bystander_report_statuses: true,
      report_missing_persons: true,
      report_casualties: true,
    },
    orderBy: {
      submitted_at: 'desc',
    },
  });

  return reports.map((r) => ({
    ...r,
    latitude: r.latitude.toNumber(),
    longitude: r.longitude.toNumber(),
  }));
}

export async function updateBystanderReportStatus(
  id: string,
  statusName: 'reviewed' | 'verified' | 'dismissed'
) {
  await requireAdmin();
  const parsed = statusUpdateSchema.parse({ id, statusName });

  const status = await prisma.bystander_report_statuses.findFirst({
    where: { name: parsed.statusName },
  });
  if (!status) throw new Error('Bystander report status not found.');

  const report = await prisma.bystander_reports.update({
    where: { id: parsed.id },
    data: { status_id: status.id },
  });

  revalidatePath('/bystander-reports');
  return {
    ...report,
    latitude: report.latitude.toNumber(),
    longitude: report.longitude.toNumber(),
  };
}

export async function getBystanderIncidentTypes() {
  return prisma.bystander_incident_types.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}
