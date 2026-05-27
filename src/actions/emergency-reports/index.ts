'use server';

import { BystanderReportFormData } from '@/lib';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createBystanderReport(data: BystanderReportFormData) {
  const { report_missing_persons, report_casualties, ...reportData } = data;

  const pendingStatus = await prisma.bystander_report_statuses.findFirst({
    where: { name: 'pending' },
  });

  return prisma.bystander_reports.create({
    data: {
      ...reportData,
      status_id: pendingStatus?.id,
      ...(report_missing_persons?.length && {
        report_missing_persons: {
          create: report_missing_persons,
        },
      }),
      ...(report_casualties?.length && {
        report_casualties: {
          create: report_casualties,
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
}

export async function getBystanderReports() {
  const reports = await prisma.bystander_reports.findMany({
    include: {
      clusters: true,
      units: true,
      bystander_incident_types: true,
      bystander_report_statuses: true,
      report_missing_persons: true,
      report_casualties: true,
    },
  });

  return reports.map((r) => ({
    ...r,
    latitude: r.latitude ? r.latitude.toNumber() : null,
    longitude: r.longitude ? r.longitude.toNumber() : null,
  }));
}

export async function updateBystanderReportStatus(
  id: string,
  statusName: 'reviewed' | 'verified' | 'dismissed'
) {
  const status = await prisma.bystander_report_statuses.findFirst({
    where: { name: statusName },
  });

  const report = await prisma.bystander_reports.update({
    where: { id },
    data: { status_id: status?.id },
  });

  revalidatePath('/bystander-reports');
  return report;
}

export async function getBystanderIncidentTypes() {
  return prisma.bystander_incident_types.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}
