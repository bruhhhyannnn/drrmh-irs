'use server';

import { toSettingsPath } from '@/lib';
import { prisma } from '@/lib/prisma';
import { toFriendlyError } from '@/lib/prisma-error';
import { settingsWriteSchemas, withoutControlChars } from '@/lib/schemas';
import { requireAdmin } from '@/lib/server-auth';
import {
  canWriteSetting,
  isGlobalSettingsTable,
  isSettingsTable,
  type SettingsTable,
} from '@/lib/settings-access';
import { isUuid, type ActionRefusal } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';

export type { SettingsTable };

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

/** What each table's Add / Edit may send (#103); see `settingsWriteSchemas` in `@/lib/schemas`. */
const WRITE_SCHEMAS: Record<SettingsTable, z.AnyZodObject> = settingsWriteSchemas;

// What each table's rows carry besides their own columns: the parent shown in the table, and
// counts of linked records for the Units column and the delete confirmation.
const INCLUDE_MAP: Partial<Record<SettingsTable, object>> = {
  clusters: {
    campus: { select: { name: true } },
    _count: { select: { units: true, users: true, reports: true } },
  },
  units: {
    cluster: { select: { name: true, campus_id: true } },
    _count: { select: { users: true, reports: true, buildings: true } },
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

/** The campus filter for a table's rows; undefined for the lists every campus shares. */
function campusWhere(table: SettingsTable, campusId: string) {
  if (table === 'clusters') return { campus_id: campusId };
  if (table === 'units') return { cluster: { campus_id: campusId } };
  if (table === 'buildings') return { unit: { cluster: { campus_id: campusId } } };
  return undefined;
}

/**
 * Every row of a lookup table, with what the settings list shows (campus, cluster, linked
 * record counts). Admins only (#103), and an Administrator gets only their own campus's
 * clusters, units and buildings. `filterId` narrows clusters to one campus and units to one
 * cluster.
 */
export async function getSettingsItems(
  token: string | null,
  table: SettingsTable,
  filterId?: string
) {
  const caller = await requireAdmin(token);
  if (!caller.ok || !isSettingsTable(table)) return [];
  if (filterId !== undefined && !isUuid(filterId)) return [];
  const model = MODEL_MAP[table];
  const scopeCampus = caller.scope.campusId;
  // Off-campus buildings come from assessments, not this table (DRRM-025).
  const where = {
    ...(table === 'buildings' && { unit_id: { not: null } }),
    ...(filterId && table === 'clusters' && { campus_id: filterId }),
    ...(filterId && table === 'units' && { cluster_id: filterId }),
    ...(scopeCampus && campusWhere(table, scopeCampus)),
  };
  // @ts-expect-error dynamic model access
  return prisma[model].findMany({ where, include: INCLUDE_MAP[table], orderBy: { name: 'asc' } });
}

function singularLabel(table: SettingsTable) {
  return TITLE_MAP[table].replace(/s$/, '').toLowerCase();
}

const refuse = (error: string): ActionRefusal => ({ ok: false, error, retry: false });
const ADMIN_ONLY = refuse('Sign in as an administrator to change settings.');

/** The campus a cluster, unit or building belongs to, by its id; undefined when it's gone. */
async function campusOfRow(table: SettingsTable, id: string): Promise<string | null | undefined> {
  if (table === 'clusters') {
    const row = await prisma.cluster.findUnique({ where: { id }, select: { campus_id: true } });
    return row ? row.campus_id : undefined;
  }
  if (table === 'units') {
    const row = await prisma.unit.findUnique({
      where: { id },
      select: { cluster: { select: { campus_id: true } } },
    });
    return row ? row.cluster.campus_id : undefined;
  }
  if (table === 'buildings') {
    const row = await prisma.building.findUnique({
      where: { id },
      select: { unit: { select: { cluster: { select: { campus_id: true } } } } },
    });
    return row ? (row.unit?.cluster.campus_id ?? null) : undefined;
  }
  return null;
}

/** The campus of the parent a row is given: a cluster's campus, a unit's cluster, a building's unit. */
async function campusOfParent(
  table: SettingsTable,
  data: Record<string, unknown>
): Promise<string | null | undefined> {
  if (table === 'clusters' && typeof data.campus_id === 'string') return data.campus_id;
  if (table === 'units' && typeof data.cluster_id === 'string') {
    return campusOfRow('clusters', data.cluster_id);
  }
  if (table === 'buildings' && typeof data.unit_id === 'string') {
    return campusOfRow('units', data.unit_id);
  }
  return null;
}

type Writer = { ok: true; data: Record<string, unknown> } | ActionRefusal;

/**
 * Checks a Settings write on the server (#103): an admin; for the lists every campus shares, a
 * Super Admin; for clusters, units and buildings, both the row as saved and the parent it is
 * given must be on a campus the caller's scope covers. `data` is parsed with the table's strict
 * schema (all optional on edit). Off-campus buildings come from assessments and are never
 * edited here.
 */
async function settingsWriter(
  token: string | null,
  table: SettingsTable,
  id: string | null,
  data: unknown
): Promise<Writer> {
  const caller = await requireAdmin(token);
  if (!caller.ok) return ADMIN_ONLY;
  if (!isSettingsTable(table)) return refuse('That list does not exist.');
  if (id !== null && !isUuid(id)) return refuse(`This ${singularLabel(table)} no longer exists.`);

  let fields: Record<string, unknown> = {};
  if (data !== undefined) {
    const schema = WRITE_SCHEMAS[table];
    let input = data as Record<string, unknown>;
    // An Administrator's new cluster is on their own campus (the form has no Campus field).
    if (table === 'clusters' && id === null && caller.scope.role === 'administrator') {
      input = { ...input, campus_id: input?.campus_id ?? caller.scope.campusId };
    }
    const parsed = (id === null ? schema : schema.partial()).safeParse(input);
    if (!parsed.success) {
      return refuse(parsed.error.issues[0]?.message ?? `Check the ${singularLabel(table)}.`);
    }
    fields = parsed.data;
    // A control character in a name would break the NSED export (#111).
    if (typeof fields.name === 'string') fields.name = withoutControlChars(fields.name);
  }

  const campuses: (string | null | undefined)[] = [];
  if (id !== null) {
    const saved = await campusOfRow(table, id);
    // Null for the lists every campus shares; undefined when the row is gone.
    if (saved === undefined) return refuse(`This ${singularLabel(table)} no longer exists.`);
    if (table === 'buildings' && saved === null) {
      return refuse('Off-campus buildings are not edited in Settings.');
    }
    if (saved !== null) campuses.push(saved);
  }
  const parent = await campusOfParent(table, fields);
  if (parent !== null) campuses.push(parent);
  if (table === 'buildings' && id === null && !fields.unit_id) {
    return refuse('Pick a unit for the building.');
  }
  if (!canWriteSetting(caller.scope, table, campuses)) {
    return refuse(
      isGlobalSettingsTable(table)
        ? `Only super admins can change ${TITLE_MAP[table].toLowerCase()}, since every campus uses them.`
        : `You can't change ${TITLE_MAP[table].toLowerCase()} of another campus.`
    );
  }
  return { ok: true, data: fields };
}

type SettingsWriteResult = { ok: true; item: { id: string } } | ActionRefusal;

export async function createSettingsItem(
  token: string | null,
  table: SettingsTable,
  data: Record<string, unknown>
): Promise<SettingsWriteResult> {
  const writer = await settingsWriter(token, table, null, data ?? {});
  if (!writer.ok) return writer;
  const model = MODEL_MAP[table];
  try {
    // @ts-expect-error dynamic model access
    const item = await prisma[model].create({ data: writer.data, select: { id: true } });
    revalidateTable(table);
    return { ok: true, item };
  } catch (err) {
    return refuse(toFriendlyError(err, singularLabel(table)).message);
  }
}

export async function updateSettingsItem(
  token: string | null,
  table: SettingsTable,
  id: string,
  data: Record<string, unknown>
): Promise<SettingsWriteResult> {
  const writer = await settingsWriter(token, table, id, data ?? {});
  if (!writer.ok) return writer;
  const model = MODEL_MAP[table];
  try {
    // @ts-expect-error dynamic model access
    const item = await prisma[model].update({
      where: { id },
      data: writer.data,
      select: { id: true },
    });
    revalidateTable(table);
    return { ok: true, item };
  } catch (err) {
    return refuse(toFriendlyError(err, singularLabel(table)).message);
  }
}

export async function deleteSettingsItem(
  token: string | null,
  table: SettingsTable,
  id: string
): Promise<{ ok: true } | ActionRefusal> {
  const writer = await settingsWriter(token, table, id, undefined);
  if (!writer.ok) return writer;
  const model = MODEL_MAP[table];
  try {
    // @ts-expect-error dynamic model access
    await prisma[model].delete({ where: { id } });
    revalidateTable(table);
    return { ok: true };
  } catch (err) {
    return refuse(toFriendlyError(err, singularLabel(table)).message);
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
