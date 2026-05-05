'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { toSettingsPath } from '@/lib';

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
