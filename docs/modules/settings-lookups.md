---
type: module
module: settings-lookups
updated: 2026-10-28
verified: true
paths:
  - src/actions/settings/index.ts
  - src/components/hooks/use-settings.ts
  - src/app/(admin)/settings
  - src/actions/population-categories/index.ts
  - src/components/hooks/use-population-categories.ts
tags: [module]
---

# Settings and lookup tables

Settings holds the lists that the report, event, user and assessment forms pick from: clusters, units, buildings, positions, casualty conditions, damage conditions, and each campus's headcount (population) fields. Administrators edit them for their own campus; Super Admins edit them for the campus picked in the top-bar switcher, or all. All the simple lists share one generic table and one set of server actions.

**Related:** [[architecture]] · [[field-reports]] · [[events]] · [[users]] · [[campus-scoping]] · [[assessments]] · [[checklist-editor]] · [[design-system]] · [[database]]

## Essentials

Read this before adding or changing a lookup table or the Settings page.

- **Generic, table-driven:** the lookup tables share one implementation, the `LOOKUPS` map and `LookupTable` in `src/app/(admin)/settings/_components/` plus `src/actions/settings`, shown as tabs on one Settings page ([[0009-table-driven-settings]]).
- **The tabs today:** clusters, units, buildings, positions, casualty conditions, damage conditions, and a separate Population fields tab.
  - There is no locations table: a report's location is free text plus coordinates.
  - User types and event statuses are seeded tables with getters here, but they have no tab.
- **New lookup table:** extend this generic pattern instead of writing a bespoke CRUD page. The steps are under Rules and gotchas below.
- **Buildings** for the MATATAG assessment are fixed on the Buildings tab ([[assessments]]).

## Where it lives

| Path                                                         | What it holds                                                                                |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `src/actions/settings/index.ts`                              | Generic CRUD by table name, plus plain getters for each lookup                               |
| `src/components/hooks/use-settings.ts`                       | `useSettingsTable`, `useCreateSetting`, `useUpdateSetting`, `useDeleteSetting`, getter hooks |
| `src/app/(admin)/settings/_components/settings-page.tsx`     | `SettingsPage`: `LOOKUPS` map, tab bar, header Add button                                    |
| `src/app/(admin)/settings/_components/lookup-table.tsx`      | `LookupTable`, `LookupDrawer`, `LookupFormBody`, `linkedWarning`                             |
| `src/app/(admin)/settings/_components/population-fields.tsx` | `PopulationFields`: per-campus headcount fields, drag to reorder                             |
| `src/app/(admin)/settings/<tab>/page.tsx`                    | One 5-line page per tab that renders `<SettingsPage tab="..." />`                            |
| `src/app/(admin)/settings/page.tsx`                          | Redirects `/settings` to `/settings/clusters`                                                |
| `src/actions/population-categories/index.ts`                 | Actions behind the Population fields tab (shared with [[field-reports]])                     |

## Data

- `Cluster` (`clusters`): `name` (unique), `campus_id`, `is_active`.
- `Unit` (`units`): `name`, `cluster_id`, `is_active`; unique on `(name, cluster_id)`.
- `Building` (`buildings`): `name`, `unit_id`, `floor_count`, `is_active`. Unique per unit on `lower(name)` (index `uq_buildings_unit_name`).
- `Position` (`positions`), `CasualtyCondition` (`casualty_conditions`), `DamageCondition` (`damage_conditions`): `name` (unique), `is_active`.
- `PopulationCategory` (`population_categories`) and `CampusPopulationCategory` (`campus_population_categories`): headcount fields and their per-campus order, required flag and active flag.
- Read only here: `UserType` (`user_types`), `EventStatus` (`event_statuses`), `campus`.

## Server actions

`src/actions/settings/index.ts` (no auth or role checks):

- `SettingsTable` type: `clusters`, `units`, `positions`, `casualty_conditions`, `campus`, `damage_conditions`, `buildings`. `MODEL_MAP` maps each to a Prisma model.
- `getSettingsItems(table, filterId?)`: all rows with `INCLUDE_MAP` extras (parent names, linked record `_count`s). `filterId` narrows clusters by campus or units by cluster.
- `createSettingsItem(table, data)`, `updateSettingsItem(table, id, data)`, `deleteSettingsItem(table, id)`: dynamic `prisma[model]` calls; errors go through `toFriendlyError`; revalidate `/settings` and the tab path from `toSettingsPath`.
- Getters: `getUnits(clusterId?)`, `getUserTypes()`, `getPositions()`, `getEventStatuses()`, `getDamageConditions()`, `getClusters()`, `getCampus()`, `getCasualtyConditions()`.

Population field actions are listed in [[field-reports]].

## Client side

- Routes: `/settings/clusters`, `/settings/units`, `/settings/buildings`, `/settings/positions`, `/settings/casualty-conditions`, `/settings/damage-conditions`, `/settings/population-fields`.
- `LookupTable` loads the whole table, then filters on the client by the scoped campus (`useScopedCampusId()`), an optional cluster filter (units and buildings), and search. It pages 10 rows at a time.
- Row actions: Edit (drawer), active switch (`is_active`), Delete (confirm dialog with `linkedWarning`).
- `LookupFormBody` picks the zod schema from `SCHEMAS` (`clusterSchema`, `unitSchema`, `buildingSchema`, `positionSchema`, `casualtyConditionSchema`, `damageConditionSchema`). Clusters get a Campus field for Super Admins only; Administrators' clusters use their own campus. Units pick a cluster. Buildings pick a unit ("Unit · Cluster") and floors (1 to 200).
- `PopulationFields`: Super Admins get a tab per active campus; Administrators see their own campus only. Order is saved on drop through `reorderCampusPopulationCategories`.
- Query keys equal the table name (`['clusters', filterId]`). Building mutations also invalidate `building-summaries`, `admin-assessments`, `assessment-setup`, `building-safety` (`ALSO_SHOWN_IN`).
- Other modules use the getter hooks directly: `useCasualtyConditions`, `useDamageConditions`, `useClusters`, `useUnits`, `usePositions`, `useUserTypes`, `useEventStatuses`, `useCampus`.

## Rules and gotchas

- Adding a lookup table means one more `SettingsTable` value, `MODEL_MAP` / `TITLE_MAP` / optional `INCLUDE_MAP` entry, a zod schema in `SCHEMAS`, a `LOOKUPS` entry and a `<tab>/page.tsx`. Do not write a bespoke CRUD page.
- The tab slug must match `toSettingsPath(TITLE_MAP[table])` (lowercase, spaces to dashes) or revalidation misses the page.
- `campus` is a `SettingsTable` but has no tab; campuses are managed on `/campus` ([[campus-scoping]]).
- User types and event statuses are read here but have no Settings tab. Event status names are matched by code (`upcoming`, `ongoing`, `completed`); renaming them breaks [[events]].
- Most foreign keys to lookups are `NoAction`, so deleting a used row fails with the P2003 friendly message. The UI tells the admin to switch the row off instead.
- Units and positions also grow from the forms: "Other (please specify)" in Add / Edit user, Edit / Add report and profile setup adds the typed name when no unit in that cluster (or position) has it in any case (`src/lib/lookup-names.ts`). Clusters grow the same way from profile setup only (DRRM-020), never with a name another campus has. Review new rows here. A cluster still on someone's profile can't be deleted (`User.cluster` is `onDelete: NoAction`): move those users first.
- Deleting a cluster cascades to its units (`Unit.cluster` is `onDelete: Cascade`) if nothing else blocks it.
- Casualty and damage condition names drive severity colours in the event summary (`(admin)/_lib/summary.ts` regexes). Rename with care.
- Inactive rows stay in old reports and are still shown when an existing record already uses them.
- Building area profiles are not edited here; area types are on the checklist editor ([[checklist-editor]]).
- Server actions accept any `data` object and do not check role or campus. Scope is enforced in the UI only.

## Decisions

- [[0009-table-driven-settings]]: one `LOOKUPS` map and `LookupTable` for every simple list.
- [[0001-server-actions-only]]: all lookup reads and writes go through `src/actions/settings`.
- [[0002-manual-sql-schema-changes]]: `buildings` and its unique name index come from `DRRM-015-assessment.sql`.
