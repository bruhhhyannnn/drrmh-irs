import { Prisma } from '@prisma/client';
import { findOrCreate } from './find-or-create';
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
  return findOrCreate(
    () =>
      prisma.unit.findFirst({
        where: { cluster_id: clusterId, name: { equals: unitName, mode: 'insensitive' } },
        select: { id: true },
      }),
    () =>
      prisma.unit.create({ data: { cluster_id: clusterId, name: unitName }, select: { id: true } })
  );
}

/**
 * `unitIdForName` inside the caller's transaction (#101): a unit a report adds is rolled back
 * with the report when the save fails. The insert is `ON CONFLICT DO NOTHING`, because a
 * unique-violation error would abort the whole transaction; a unit another member added at the
 * same moment is reused once their transaction commits, as `findOrCreate` does outside one.
 */
export async function unitIdForNameIn(
  tx: Prisma.TransactionClient,
  clusterId: string,
  name: string
) {
  const unitName = tidy(name);
  const find = () =>
    tx.unit.findFirst({
      where: { cluster_id: clusterId, name: { equals: unitName, mode: 'insensitive' } },
      select: { id: true },
    });
  const existing = await find();
  if (existing) return existing.id;
  const [added] = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO units (id, name, cluster_id)
    VALUES (gen_random_uuid(), ${unitName}, ${clusterId}::uuid)
    ON CONFLICT DO NOTHING
    RETURNING id`;
  if (added) return added.id;
  const theirs = await find();
  if (!theirs) throw new Error('The unit could not be added to this cluster.');
  return theirs.id;
}

/** The position called `name`, added when there's none by that name. */
export async function positionIdForName(name: string) {
  const positionName = tidy(name);
  return findOrCreate(
    () =>
      prisma.position.findFirst({
        where: { name: { equals: positionName, mode: 'insensitive' } },
        select: { id: true },
      }),
    () => prisma.position.create({ data: { name: positionName }, select: { id: true } })
  );
}
