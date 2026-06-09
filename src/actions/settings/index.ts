'use server';

import {
  casualtyConditionSchema,
  clusterSchema,
  damageConditionSchema,
  eventStatusSchema,
  locationSchema,
  positionSchema,
  unitSchema,
  userTypeSchema,
} from '@/lib/schemas';
import { toSettingsPath } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/server-auth';
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

const SCHEMA_MAP = {
  clusters: clusterSchema,
  units: unitSchema,
  locations: locationSchema,
  positions: positionSchema,
  user_types: userTypeSchema,
  event_statuses: eventStatusSchema,
  casualty_conditions: casualtyConditionSchema,
  damage_conditions: damageConditionSchema,
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

function resolveModel(table: SettingsTable) {
  const model = MODEL_MAP[table];
  if (!model) throw new Error('Invalid settings table.');
  return model;
}

function parseSettingsData(table: SettingsTable, data: Record<string, unknown>) {
  const schema = SCHEMA_MAP[table];
  if (!schema) throw new Error('Invalid settings table.');
  return schema.parse(data);
}

function revalidateTable(table: SettingsTable) {
  revalidatePath('/settings');
  revalidatePath(toSettingsPath(TITLE_MAP[table]));
}

export async function getSettingsItems(table: SettingsTable) {
  await requireAdmin();
  const model = resolveModel(table);
  // @ts-expect-error dynamic model access
  return prisma[model].findMany({ orderBy: { name: 'asc' } });
}

export async function createSettingsItem(table: SettingsTable, data: Record<string, unknown>) {
  await requireAdmin();
  const model = resolveModel(table);
  const parsed = parseSettingsData(table, data);
  // @ts-expect-error dynamic model access
  const result = await prisma[model].create({ data: parsed });
  revalidateTable(table);
  return result;
}

export async function updateSettingsItem(
  table: SettingsTable,
  id: string,
  data: Record<string, unknown>
) {
  await requireAdmin();
  const model = resolveModel(table);
  const parsed = parseSettingsData(table, data);
  // @ts-expect-error dynamic model access
  const result = await prisma[model].update({ where: { id }, data: parsed });
  revalidateTable(table);
  return result;
}

export async function deleteSettingsItem(table: SettingsTable, id: string) {
  await requireAdmin();
  const model = resolveModel(table);
  // @ts-expect-error dynamic model access
  await prisma[model].delete({ where: { id } });
  revalidateTable(table);
}

export async function getUnits(clusterId?: string) {
  return prisma.unit.findMany({
    where: { is_active: true, ...(clusterId ? { cluster_id: clusterId } : {}) },
    include: { cluster: { select: { name: true } } },
    orderBy: { created_at: 'asc' },
  });
}

export async function getUserTypes() {
  await requireAdmin();
  return prisma.userType.findMany({ orderBy: { name: 'asc' } });
}

export async function getPositions() {
  return prisma.position.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } });
}

export async function getLocations(clusterId?: string) {
  return prisma.location.findMany({
    where: { is_active: true, ...(clusterId ? { cluster_id: clusterId } : {}) },
    include: { cluster: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getEventStatuses() {
  await requireAdmin();
  return prisma.eventStatus.findMany({ orderBy: { updated_at: 'asc' } });
}

export async function getDamageConditions() {
  return prisma.damageCondition.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } });
}

export async function getClusters() {
  return prisma.cluster.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } });
}

export async function getCasualtyConditions() {
  return prisma.casualtyCondition.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });
}
