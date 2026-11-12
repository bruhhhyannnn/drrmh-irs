---
type: feature
ticket: DRRM-040
status: done
branch: feat/DRRM-040-settings-used-by
modules:
  - '[[settings-lookups]]'
tags: [plan, feature, design-round-2026-11-11]
---

# [DRRM-040] Feature Plan: Settings: Used by column to clean up unused clusters, units and positions

- **Status:** `[Done]`
- **Target Branch / PR:** `feat/DRRM-040-settings-used-by`
- **Owner / Author:** Bryan Mangapit

> Design source: the screenshots below are the whole design. Don't open the Claude Design canvas for this ticket; it also holds older turns (1–8) that are already built.
> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`. Afterwards update the module notes listed in `modules:` and add a line to `docs/changelog.md`.

---

## 1. Problem Statement & Motivation

Many units and positions were added that may never have been used. Admins can't see which rows are safe to delete.

---

## 2. Design

![SA58 settings used by](../../design/2026-11-11-admin-polish/SA58-settings-used-by.png)

---

## 3. Requirements & Acceptance Criteria

**Used by column**

| Tab       | Counts shown              |
| --------- | ------------------------- |
| Clusters  | users, units, reports     |
| Units     | users, reports, buildings |
| Positions | users                     |

- [x] Rows with nothing pointing at them show an outlined "Unused" chip.

**Filtering and sorting**

- [x] An All / In use / Unused segmented control, with a count on each, filters the table.
- [x] Used by is sortable.
- [x] When there are unused rows, an info note above the table reads: "N units are unused … Show unused".

**Delete**

- [x] Stays per row.
- [x] In-use rows keep today's blocking dialog (`linkedWarning`), and their delete icon is grey.

---

## 4. Technical Design

- [`src/actions/settings/index.ts`](../../../src/actions/settings/index.ts): `INCLUDE_MAP` already counts users and reports; add `buildings` for units and `units` for clusters.
- [`src/app/(admin)/settings/_components/lookup-table.tsx`](<../../../src/app/(admin)/settings/_components/lookup-table.tsx>): the column, filter, sort and note.

---

## 5. Implementation Tasks

- [x] Counts in the action
- [x] Column, chip, filter, sort, note
- [x] Update `docs/modules/settings-lookups.md`

---

## Notes from the build

- Units' `_count` gained `buildings`; clusters already counted units.
- Used by replaces the Clusters table's Units column (units are one of its counts).
- `IconAction` takes `tone="danger"` for the red Delete on unused rows; `Column.header` and `SegmentedControl` labels can be any node (the sort button, the counts).
- Checked in a temporary preview with sample units: the column and chips, the note and Show unused, the filter and the sort, and the phone cards (no sideways scroll).

## 6. Out of Scope

- Bulk delete.
