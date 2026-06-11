'use server';

import { toSettingsPath } from '@/lib';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export type SettingsTable =
  | 'clusters'
  | 'units'
  | 'locations'
  | 'positions'
  | 'user_types'
  | 'event_statuses'
  | 'casualty_conditions'
  | 'damage_conditions';

const MODEL_MAP = {
  clusters: 'cluster',
  units: 'unit',
  locations: 'location',
  positions: 'position',
  user_types: 'userType',
  event_statuses: 'eventStatus',
  casualty_conditions: 'casualtyCondition',
  damage_conditions: 'damageCondition',
} as const;

const TITLE_MAP: Record<SettingsTable, string> = {
  clusters: 'Clusters',
  units: 'Units',
  locations: 'Locations',
  positions: 'Positions',
  user_types: 'User Types',
  event_statuses: 'Event Statuses',
  casualty_conditions: 'Casualty Conditions',
  damage_conditions: 'Damage Conditions',
};

function revalidateTable(table: SettingsTable) {
  revalidatePath('/settings');
  revalidatePath(toSettingsPath(TITLE_MAP[table]));
}

export async function getSettingsItems(table: SettingsTable) {
  const model = MODEL_MAP[table];
  // @ts-expect-error dynamic model access
  return prisma[model].findMany({ orderBy: { name: 'asc' } });
}

export async function createSettingsItem(table: SettingsTable, data: Record<string, unknown>) {
  const model = MODEL_MAP[table];
  // @ts-expect-error dynamic model access
  const result = await prisma[model].create({ data });
  revalidateTable(table);
  return result;
}

export async function updateSettingsItem(
  table: SettingsTable,
  id: string,
  data: Record<string, unknown>
) {
  const model = MODEL_MAP[table];
  // @ts-expect-error dynamic model access
  const result = await prisma[model].update({ where: { id }, data });
  revalidateTable(table);
  return result;
}

export async function deleteSettingsItem(table: SettingsTable, id: string) {
  const model = MODEL_MAP[table];
  // @ts-expect-error dynamic model access
  await prisma[model].delete({ where: { id } });
  revalidateTable(table);
}

// Individual Settings Item

export async function getUnits(clusterId?: string) {
  return prisma.unit.findMany({
    where: {
      is_active: true,
      ...(clusterId ? { cluster_id: clusterId } : undefined),
    },
    include: { cluster: { select: { name: true } } },
    orderBy: { created_at: 'asc' },
  });
}

export async function getUserTypes() {
  return prisma.userType.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}

export async function getPositions() {
  return prisma.position.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}

export async function getLocations(clusterId?: string) {
  return prisma.location.findMany({
    where: {
      is_active: true,
      ...(clusterId ? { cluster_id: clusterId } : undefined),
    },
    include: { cluster: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getEventStatuses() {
  return prisma.eventStatus.findMany({
    where: { is_active: true },
    orderBy: { updated_at: 'asc' },
  });
}

export async function getDamageConditions() {
  return prisma.damageCondition.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}

export async function getClusters() {
  return prisma.cluster.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}

export async function getCasualtyConditions() {
  return prisma.casualtyCondition.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}
