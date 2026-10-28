'use server';

import { toSettingsPath } from '@/lib';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { revalidatePath } from 'next/cache';

export type SettingsTable =
  | 'clusters'
  | 'units'
  | 'positions'
  | 'casualty_conditions'
  | 'campus'
  | 'damage_conditions'
  | 'buildings';

const MODEL_MAP = {
  clusters: 'cluster',
  units: 'unit',
  positions: 'position',
  casualty_conditions: 'casualtyCondition',
  damage_conditions: 'damageCondition',
  campus: 'campus',
  buildings: 'building',
} as const;

const TITLE_MAP: Record<SettingsTable, string> = {
  clusters: 'Clusters',
  units: 'Units',
  positions: 'Positions',
  casualty_conditions: 'Casualty Conditions',
  campus: 'Campus',
  damage_conditions: 'Damage Conditions',
  buildings: 'Buildings',
};

// What each table's rows carry besides their own columns: the parent shown in the table, and
// counts of linked records for the Units column and the delete confirmation.
const INCLUDE_MAP: Partial<Record<SettingsTable, object>> = {
  clusters: {
    campus: { select: { name: true } },
    _count: { select: { units: true, users: true, reports: true } },
  },
  units: {
    cluster: { select: { name: true, campus_id: true } },
    _count: { select: { users: true, reports: true } },
  },
  positions: { _count: { select: { users: true } } },
  casualty_conditions: { _count: { select: { casualties: true } } },
  damage_conditions: { _count: { select: { reports: true, bystander_reports: true } } },
  buildings: {
    unit: {
      select: {
        name: true,
        cluster_id: true,
        cluster: { select: { name: true, campus_id: true } },
      },
    },
    _count: { select: { assessments: true } },
  },
};

function revalidateTable(table: SettingsTable) {
  revalidatePath('/settings');
  revalidatePath(toSettingsPath(TITLE_MAP[table]));
}

/**
 * Every row of a lookup table, with what the settings list shows (campus, cluster, linked
 * record counts). `filterId` narrows clusters to one campus and units to one cluster.
 */
export async function getSettingsItems(table: SettingsTable, filterId?: string) {
  const model = MODEL_MAP[table];
  const where = !filterId
    ? undefined
    : table === 'clusters'
      ? { campus_id: filterId }
      : table === 'units'
        ? { cluster_id: filterId }
        : undefined;
  // @ts-expect-error dynamic model access
  return prisma[model].findMany({ where, include: INCLUDE_MAP[table], orderBy: { name: 'asc' } });
}

function singularLabel(table: SettingsTable) {
  return TITLE_MAP[table].replace(/s$/, '').toLowerCase();
}

export async function createSettingsItem(table: SettingsTable, data: Record<string, unknown>) {
  const model = MODEL_MAP[table];
  try {
    // @ts-expect-error dynamic model access
    const result = await prisma[model].create({ data });
    revalidateTable(table);
    return result;
  } catch (err) {
    throw toFriendlyError(err, singularLabel(table));
  }
}

export async function updateSettingsItem(
  table: SettingsTable,
  id: string,
  data: Record<string, unknown>
) {
  const model = MODEL_MAP[table];
  try {
    // @ts-expect-error dynamic model access
    const result = await prisma[model].update({ where: { id }, data });
    revalidateTable(table);
    return result;
  } catch (err) {
    throw toFriendlyError(err, singularLabel(table));
  }
}

export async function deleteSettingsItem(table: SettingsTable, id: string) {
  const model = MODEL_MAP[table];
  try {
    // @ts-expect-error dynamic model access
    await prisma[model].delete({ where: { id } });
    revalidateTable(table);
  } catch (err) {
    throw toFriendlyError(err, singularLabel(table));
  }
}

// Individual Settings Item

export async function getUnits(clusterId?: string) {
  return prisma.unit.findMany({
    where: {
      ...(clusterId ? { cluster_id: clusterId } : undefined),
    },
    include: { cluster: { select: { name: true } } },
    orderBy: { created_at: 'asc' },
  });
}

export async function getUserTypes() {
  return prisma.userType.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getPositions() {
  return prisma.position.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getEventStatuses() {
  return prisma.eventStatus.findMany({
    orderBy: { updated_at: 'asc' },
  });
}

export async function getDamageConditions() {
  return prisma.damageCondition.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getClusters() {
  return prisma.cluster.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getCampus() {
  return prisma.campus.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getCasualtyConditions() {
  return prisma.casualtyCondition.findMany({
    orderBy: { name: 'asc' },
  });
}
