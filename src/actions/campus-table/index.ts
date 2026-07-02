'use server';

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

export async function getCampuses(query?: string) {
  return prisma.campus.findMany({
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

export async function getCampusEvents(query?: string) {
  const completedStatus = await prisma.eventStatus.findFirst({
    where: { name: { equals: 'completed', mode: 'insensitive' } },
    select: { id: true },
  });

  const completed = await prisma.event.findMany({
    where: { status_id: completedStatus?.id },
    select: { id: true, name: true, status: { select: { name: true } } },
    orderBy: { started_at: 'desc' },
  });

  const others = await prisma.event.findMany({
    where: { status_id: { not: completedStatus?.id } },
    select: { id: true, name: true, status: { select: { name: true } } },
  });

  return [...completed, ...others];
}

export async function getCampusHeadcountPerEvent(eventId: string, campusId: string) {
  const counts = await prisma.report.groupBy({
    by: ['event_id', 'cluster_id', 'unit_id'],
    where: { event_id: eventId, cluster: { campus_id: campusId } },
    _sum: {
      faculty_members: true,
      admin_members: true,
      reps_members: true,
      ra_members: true,
      students: true,
      philcare_staff: true,
      security_personnel: true,
      construction_workers: true,
      tenants: true,
      health_workers: true,
      non_academic_staff: true,
      guests: true,
    },
  });

  const clusters = await prisma.cluster.findMany({
    where: { id: { in: counts.map((c) => c.cluster_id) } },
    select: {
      id: true,
      name: true,
      campus: { select: { id: true, name: true } },
    },
  });

  const units = await prisma.unit.findMany({
    where: { id: { in: counts.map((c) => c.unit_id).filter((id): id is string => !!id) } },
    select: {
      id: true,
      name: true,
      cluster_id: true,
    },
  });

  type UnitHeadCount = {
    unit: { id: string; name: string };
    facultyMembersCount: number;
    adminMembersCount: number;
    repMembersCount: number;
    raMembersCount: number;
    studentsCount: number;
    philcareStaffCount: number;
    securityPersonelCount: number;
    constructionWorkersCount: number;
    tenantsCount: number;
    healthWorkersCount: number;
    nonAcademicStaffCount: number;
    guestsCount: number;
    totalCount: number;
  };

  type ClusterHeadCount = {
    cluster: { id: string; name: string };
    facultyMembersCount: number;
    adminMembersCount: number;
    repMembersCount: number;
    raMembersCount: number;
    studentsCount: number;
    philcareStaffCount: number;
    securityPersonelCount: number;
    constructionWorkersCount: number;
    tenantsCount: number;
    healthWorkersCount: number;
    nonAcademicStaffCount: number;
    guestsCount: number;
    totalCount: number;
    units: UnitHeadCount[];
  };

  type CampusHeadCount = {
    campus: { id: string; name: string };
    facultyMembersCount: number;
    adminMembersCount: number;
    repMembersCount: number;
    raMembersCount: number;
    studentsCount: number;
    philcareStaffCount: number;
    securityPersonelCount: number;
    constructionWorkersCount: number;
    tenantsCount: number;
    healthWorkersCount: number;
    nonAcademicStaffCount: number;
    guestsCount: number;
    totalCount: number;
    clusters: ClusterHeadCount[];
  };

  const campusMap: Record<string, CampusHeadCount> = {};

  for (const count of counts) {
    const cluster = clusters.find((cluster) => cluster.id === count.cluster_id);
    const unit = units.find((unit) => unit.id === count.unit_id);
    if (!cluster) continue;

    const { id, name } = cluster.campus;
    const facultyMembersCount = count._sum.faculty_members ?? 0;
    const adminMembersCount = count._sum.admin_members ?? 0;
    const repMembersCount = count._sum.reps_members ?? 0;
    const raMembersCount = count._sum.ra_members ?? 0;
    const studentsCount = count._sum.students ?? 0;
    const philcareStaffCount = count._sum.philcare_staff ?? 0;
    const securityPersonelCount = count._sum.security_personnel ?? 0;
    const constructionWorkersCount = count._sum.construction_workers ?? 0;
    const tenantsCount = count._sum.tenants ?? 0;
    const healthWorkersCount = count._sum.health_workers ?? 0;
    const nonAcademicStaffCount = count._sum.non_academic_staff ?? 0;
    const guestsCount = count._sum.guests ?? 0;

    if (!campusMap[id]) {
      campusMap[id] = {
        campus: { id, name },
        facultyMembersCount: 0,
        adminMembersCount: 0,
        repMembersCount: 0,
        raMembersCount: 0,
        studentsCount: 0,
        philcareStaffCount: 0,
        securityPersonelCount: 0,
        constructionWorkersCount: 0,
        tenantsCount: 0,
        healthWorkersCount: 0,
        nonAcademicStaffCount: 0,
        guestsCount: 0,
        totalCount: 0,
        clusters: [],
      };
    }

    let clusterHeadCount = campusMap[id].clusters.find((c) => c.cluster.id === cluster.id);
    if (!clusterHeadCount) {
      clusterHeadCount = {
        cluster: { id: cluster.id, name: cluster.name },
        facultyMembersCount: 0,
        adminMembersCount: 0,
        repMembersCount: 0,
        raMembersCount: 0,
        studentsCount: 0,
        philcareStaffCount: 0,
        securityPersonelCount: 0,
        constructionWorkersCount: 0,
        tenantsCount: 0,
        healthWorkersCount: 0,
        nonAcademicStaffCount: 0,
        guestsCount: 0,
        totalCount: 0,
        units: [],
      };
      campusMap[id].clusters.push(clusterHeadCount);
    }

    if (unit) {
      let unitHeadCount = clusterHeadCount.units.find((u) => u.unit.id === unit.id);
      if (!unitHeadCount) {
        unitHeadCount = {
          unit: { id: unit.id, name: unit.name },
          facultyMembersCount: 0,
          adminMembersCount: 0,
          repMembersCount: 0,
          raMembersCount: 0,
          studentsCount: 0,
          philcareStaffCount: 0,
          securityPersonelCount: 0,
          constructionWorkersCount: 0,
          tenantsCount: 0,
          healthWorkersCount: 0,
          nonAcademicStaffCount: 0,
          guestsCount: 0,
          totalCount: 0,
        };
        clusterHeadCount.units.push(unitHeadCount);
      }

      unitHeadCount.facultyMembersCount += facultyMembersCount;
      unitHeadCount.adminMembersCount += adminMembersCount;
      unitHeadCount.repMembersCount += repMembersCount;
      unitHeadCount.raMembersCount += raMembersCount;
      unitHeadCount.studentsCount += studentsCount;
      unitHeadCount.philcareStaffCount += philcareStaffCount;
      unitHeadCount.securityPersonelCount += securityPersonelCount;
      unitHeadCount.constructionWorkersCount += constructionWorkersCount;
      unitHeadCount.tenantsCount += tenantsCount;
      unitHeadCount.healthWorkersCount += healthWorkersCount;
      unitHeadCount.nonAcademicStaffCount += nonAcademicStaffCount;
      unitHeadCount.guestsCount += guestsCount;
      unitHeadCount.totalCount +=
        facultyMembersCount +
        adminMembersCount +
        repMembersCount +
        raMembersCount +
        studentsCount +
        philcareStaffCount +
        securityPersonelCount +
        constructionWorkersCount +
        tenantsCount +
        healthWorkersCount +
        nonAcademicStaffCount +
        guestsCount;
    }

    clusterHeadCount.facultyMembersCount += facultyMembersCount;
    clusterHeadCount.adminMembersCount += adminMembersCount;
    clusterHeadCount.repMembersCount += repMembersCount;
    clusterHeadCount.raMembersCount += raMembersCount;
    clusterHeadCount.studentsCount += studentsCount;
    clusterHeadCount.philcareStaffCount += philcareStaffCount;
    clusterHeadCount.securityPersonelCount += securityPersonelCount;
    clusterHeadCount.constructionWorkersCount += constructionWorkersCount;
    clusterHeadCount.tenantsCount += tenantsCount;
    clusterHeadCount.healthWorkersCount += healthWorkersCount;
    clusterHeadCount.nonAcademicStaffCount += nonAcademicStaffCount;
    clusterHeadCount.guestsCount += guestsCount;
    clusterHeadCount.totalCount +=
      facultyMembersCount +
      adminMembersCount +
      repMembersCount +
      raMembersCount +
      studentsCount +
      philcareStaffCount +
      securityPersonelCount +
      constructionWorkersCount +
      tenantsCount +
      healthWorkersCount +
      nonAcademicStaffCount +
      guestsCount;

    campusMap[id].facultyMembersCount += facultyMembersCount;
    campusMap[id].adminMembersCount += adminMembersCount;
    campusMap[id].repMembersCount += repMembersCount;
    campusMap[id].raMembersCount += raMembersCount;
    campusMap[id].studentsCount += studentsCount;
    campusMap[id].philcareStaffCount += philcareStaffCount;
    campusMap[id].securityPersonelCount += securityPersonelCount;
    campusMap[id].constructionWorkersCount += constructionWorkersCount;
    campusMap[id].tenantsCount += tenantsCount;
    campusMap[id].healthWorkersCount += healthWorkersCount;
    campusMap[id].nonAcademicStaffCount += nonAcademicStaffCount;
    campusMap[id].guestsCount += guestsCount;
    campusMap[id].totalCount +=
      facultyMembersCount +
      adminMembersCount +
      repMembersCount +
      raMembersCount +
      studentsCount +
      philcareStaffCount +
      securityPersonelCount +
      constructionWorkersCount +
      tenantsCount +
      healthWorkersCount +
      nonAcademicStaffCount +
      guestsCount;
  }

  return Object.values(campusMap);
}

export async function getCampusClusters(campusId: string) {
  return await prisma.cluster.findMany({
    where: { campus_id: campusId },
    select: { id: true, name: true },
  });
}
