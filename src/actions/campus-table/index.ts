'use server';

import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import type { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';

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

export async function getCampusEvents(query?: string) {
  const completedStatus = await prisma.eventStatus.findFirst({
    where: { name: { equals: 'completed', mode: 'insensitive' } },
    select: { id: true },
  });

  const completed = await prisma.event.findMany({
    where: { status_id: completedStatus?.id, campus_id: query },
    select: { id: true, name: true, status: { select: { name: true } }, campus_id: true },
    orderBy: { started_at: 'desc' },
  });

  const others = await prisma.event.findMany({
    where: { status_id: { not: completedStatus?.id }, campus_id: query },
    select: { id: true, name: true, status: { select: { name: true } }, campus_id: true },
  });

  return [...completed, ...others];
}

export async function getCampusHeadcountPerEvent(eventId: string, campusId: string) {
  const reports = await prisma.report.findMany({
    where: { event_id: eventId, cluster: { campus_id: campusId } },
    select: {
      cluster_id: true,
      unit_id: true,
      population_counts: {
        select: { count: true, category: { select: { id: true, name: true } } },
      },
    },
  });

  const clusters = await prisma.cluster.findMany({
    where: { id: { in: reports.map((r) => r.cluster_id) } },
    select: {
      id: true,
      name: true,
      campus: { select: { id: true, name: true } },
    },
  });

  const units = await prisma.unit.findMany({
    where: { id: { in: reports.map((r) => r.unit_id).filter((id): id is string => !!id) } },
    select: {
      id: true,
      name: true,
      cluster_id: true,
    },
  });

  type CategoryCount = { category: { id: string; name: string }; count: number };

  type UnitHeadCount = {
    unit: { id: string; name: string };
    counts: CategoryCount[];
    totalCount: number;
  };

  type ClusterHeadCount = {
    cluster: { id: string; name: string };
    counts: CategoryCount[];
    totalCount: number;
    units: UnitHeadCount[];
  };

  type CampusHeadCount = {
    campus: { id: string; name: string };
    counts: CategoryCount[];
    totalCount: number;
    clusters: ClusterHeadCount[];
  };

  const campusMap: Record<
    string,
    {
      campus: { id: string; name: string };
      countsById: Map<string, CategoryCount>;
      totalCount: number;
      clusters: Map<
        string,
        {
          cluster: { id: string; name: string };
          countsById: Map<string, CategoryCount>;
          totalCount: number;
          units: Map<
            string,
            {
              unit: { id: string; name: string };
              countsById: Map<string, CategoryCount>;
              totalCount: number;
            }
          >;
        }
      >;
    }
  > = {};

  const addCounts = (
    target: Map<string, CategoryCount>,
    counts: { count: number; category: { id: string; name: string } }[]
  ) => {
    let total = 0;
    for (const pc of counts) {
      const existing = target.get(pc.category.id);
      if (existing) {
        existing.count += pc.count;
      } else {
        target.set(pc.category.id, { category: pc.category, count: pc.count });
      }
      total += pc.count;
    }
    return total;
  };

  for (const report of reports) {
    const cluster = clusters.find((c) => c.id === report.cluster_id);
    const unit = units.find((u) => u.id === report.unit_id);
    if (!cluster) continue;

    const { id, name } = cluster.campus;
    if (!campusMap[id]) {
      campusMap[id] = {
        campus: { id, name },
        countsById: new Map(),
        totalCount: 0,
        clusters: new Map(),
      };
    }
    const campusEntry = campusMap[id];

    if (!campusEntry.clusters.has(cluster.id)) {
      campusEntry.clusters.set(cluster.id, {
        cluster: { id: cluster.id, name: cluster.name },
        countsById: new Map(),
        totalCount: 0,
        units: new Map(),
      });
    }
    const clusterEntry = campusEntry.clusters.get(cluster.id)!;

    let unitEntry:
      | {
          unit: { id: string; name: string };
          countsById: Map<string, CategoryCount>;
          totalCount: number;
        }
      | undefined;
    if (unit) {
      if (!clusterEntry.units.has(unit.id)) {
        clusterEntry.units.set(unit.id, {
          unit: { id: unit.id, name: unit.name },
          countsById: new Map(),
          totalCount: 0,
        });
      }
      unitEntry = clusterEntry.units.get(unit.id);
    }

    if (unitEntry) {
      unitEntry.totalCount += addCounts(unitEntry.countsById, report.population_counts);
    }
    clusterEntry.totalCount += addCounts(clusterEntry.countsById, report.population_counts);
    campusEntry.totalCount += addCounts(campusEntry.countsById, report.population_counts);
  }

  const serializeCampus = (entry: (typeof campusMap)[string]): CampusHeadCount => ({
    campus: entry.campus,
    counts: Array.from(entry.countsById.values()),
    totalCount: entry.totalCount,
    clusters: Array.from(entry.clusters.values()).map((c) => ({
      cluster: c.cluster,
      counts: Array.from(c.countsById.values()),
      totalCount: c.totalCount,
      units: Array.from(c.units.values()).map((u) => ({
        unit: u.unit,
        counts: Array.from(u.countsById.values()),
        totalCount: u.totalCount,
      })),
    })),
  });

  return Object.values(campusMap).map(serializeCampus);
}

export async function getCampusClusters(campusId: string) {
  return await prisma.cluster.findMany({
    where: { campus_id: campusId },
    select: { id: true, name: true, is_active: true },
  });
}

export async function getEventDamages(eventId: string, campusId: string) {
  return await prisma.report.findMany({
    where: {
      event_id: eventId,
      cluster: { campus_id: campusId },
      damage_condition_id: { not: null },
    },
    select: {
      id: true,
      damage_condition_id: true,
      cluster: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
      damage_conditions: { select: { id: true, name: true } },
    },
  });
}
