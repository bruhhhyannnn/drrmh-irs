import { prisma } from './prisma';

// "Other (please specify)" in the unit and position selects: the typed name becomes an id. A
// unit or position already called that (in any case) is reused, otherwise it's added, so it
// shows in Settings and in the lists from then on. Server only (Prisma): call it from server
// actions, never from components.

const tidy = (name: string) => name.trim().replace(/\s+/g, ' ');

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
