import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

// "Other (please specify)" in the cluster, unit and position selects: the typed name becomes an
// id. A cluster, unit or position already called that (in any case) is reused, otherwise it's
// added, so it shows in Settings and in the lists from then on. Server only (Prisma): call it
// from server actions, never from components.

const tidy = (name: string) => name.trim().replace(/\s+/g, ' ');

/**
 * The cluster called `name` on the campus, added when no campus has one by that name. Cluster
 * names are unique across all campuses, so a name another campus already has (in any case) gives
 * `null`.
 */
export async function clusterIdForName(campusId: string, name: string) {
  const clusterName = tidy(name);
  const sameName = () =>
    prisma.cluster.findMany({
      where: { name: { equals: clusterName, mode: 'insensitive' } },
      select: { id: true, campus_id: true },
    });
  const existing = await sameName();
  if (existing.length) return existing.find((c) => c.campus_id === campusId)?.id ?? null;
  try {
    const cluster = await prisma.cluster.create({
      data: { campus_id: campusId, name: clusterName },
      select: { id: true },
    });
    return cluster.id;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    // Someone added it a moment ago: theirs is reused when it's on this campus.
    return (await sameName()).find((c) => c.campus_id === campusId)?.id ?? null;
  }
}

/** The unit called `name` in the cluster, added when the cluster has none by that name. */
export async function unitIdForName(clusterId: string, name: string) {
  const unitName = tidy(name);
  const existing = await prisma.unit.findFirst({
    where: { cluster_id: clusterId, name: { equals: unitName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const unit = await prisma.unit.create({
    data: { cluster_id: clusterId, name: unitName },
    select: { id: true },
  });
  return unit.id;
}

/** The position called `name`, added when there's none by that name. */
export async function positionIdForName(name: string) {
  const positionName = tidy(name);
  const existing = await prisma.position.findFirst({
    where: { name: { equals: positionName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const position = await prisma.position.create({
    data: { name: positionName },
    select: { id: true },
  });
  return position.id;
}
