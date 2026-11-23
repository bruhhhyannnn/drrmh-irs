import { inScope, type AdminScope } from './admin-scope';

// Who may change which Settings list (#103). Decided on the server from the verified caller's
// scope; the Settings page uses the same rule to hide what an admin can't change.

export type SettingsTable =
  | 'clusters'
  | 'units'
  | 'positions'
  | 'casualty_conditions'
  | 'campus'
  | 'damage_conditions'
  | 'buildings';

export const SETTINGS_TABLES: readonly SettingsTable[] = [
  'clusters',
  'units',
  'positions',
  'casualty_conditions',
  'campus',
  'damage_conditions',
  'buildings',
];

/** Lists only a Super Admin changes: the campuses themselves. */
export const GLOBAL_SETTINGS_TABLES: readonly SettingsTable[] = ['campus'];

/**
 * Shared lists with no campus (positions, casualty and damage conditions): any admin may add,
 * edit or delete their rows, since every campus picks from the same list (#103, owner decision).
 */
export const SHARED_SETTINGS_TABLES: readonly SettingsTable[] = [
  'positions',
  'casualty_conditions',
  'damage_conditions',
];

export const isSettingsTable = (table: unknown): table is SettingsTable =>
  SETTINGS_TABLES.includes(table as SettingsTable);

export const isGlobalSettingsTable = (table: SettingsTable) =>
  GLOBAL_SETTINGS_TABLES.includes(table);

export const isSharedSettingsTable = (table: SettingsTable) =>
  SHARED_SETTINGS_TABLES.includes(table);

/**
 * Whether this admin may write a row of `table` that belongs to these campuses: the row's
 * campus as saved and the campus of the parent it is given (cluster: its campus; unit: its
 * cluster's; building: its unit's cluster's). A Super Admin may write anything. An Administrator
 * may write the shared lists (no campus to check), and clusters, units and buildings only when
 * every campus is their own. A row with no campus (an off-campus building) is never an
 * Administrator's, and campuses are Super Admin only.
 */
export function canWriteSetting(
  scope: AdminScope & { ok: true },
  table: SettingsTable,
  campusIds: (string | null | undefined)[]
): boolean {
  if (scope.role === 'super_admin') return true;
  if (isGlobalSettingsTable(table)) return false;
  if (isSharedSettingsTable(table)) return campusIds.length === 0;
  return (
    campusIds.length > 0 && campusIds.every((id) => typeof id === 'string' && inScope(scope, id))
  );
}
