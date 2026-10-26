---
type: module
module: building-safety
updated: 2026-10-22
verified: true
paths:
  - src/actions/building-safety
  - src/app/(admin)/dashboard/_components/building-safety
  - src/lib/building-safety.ts
  - src/app/(admin)/_components/charts
  - src/lib/pillars.ts
tags: [module]
---

# Building safety (dashboard)

The Building safety section of the admin dashboard pools the latest building assessments and drills Campus → Cluster → Unit → Building in place. Each level shows overall and pillar scores, the like-for-like change, section scores and the most-failed items; the building level shows its history and an A/B comparison. Administrators see their own campus; Super Admins can start from all campuses. The arithmetic is pure code with tests.

**Related:** [[architecture]] · [[dashboard]] · [[assessments]] · [[assessment-admin]] · [[campus-scoping]] · [[design-system]] · [[pillars-and-landing]]

## Essentials

Read this before touching the dashboard's Building safety section, its actions, the score arithmetic or the charts.

- **Where:** the section is in `(admin)/dashboard/_components/building-safety/`, with its actions in `src/actions/building-safety`. It drills Campus → Cluster → Unit → Building.
- **URL state:** the level is kept in the `bs_campus` / `bs_cluster` / `bs_unit` / `bs_building` / `bs_a` / `bs_b` URL params. Drilling pushes a history entry, and the A/B picks replace it. The section never moves the campus switcher.
- **Pure functions:** pooling, the like-for-like change, section scores, most-failed items, the A/B comparison and `scopeFromParams` are pure functions in `src/lib/building-safety.ts`, with tests. So is the score arithmetic the admin pages share (pillar rows, change in points).
- **Charts:** hand-built in `(admin)/_components/charts/`, coloured with the `--series-1…6` tokens from `globals.css`, checked with the dataviz validator, and with every value printed ([[0008-hand-built-charts]]).

## Where it lives

| Path                                                                        | What it holds                                                                                  |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/actions/building-safety/index.ts`                                      | `getSafetyRollup`, `getBuildingHistory`, `compareAssessments`                                  |
| `src/app/(admin)/dashboard/_components/building-safety/building-safety.tsx` | `BuildingSafety` section, URL state (`bs_*` params), aggregate level                           |
| `src/app/(admin)/dashboard/_components/building-safety/building-level.tsx`  | `BuildingLevel`, `BuildingCompareView` (also used by the Assessments → Compare tab)            |
| `src/app/(admin)/dashboard/_components/building-safety/parts.tsx`           | `Breadcrumb`, `SummaryTiles`, `ChildrenTable`, `SectionScores`, `MostFailed`, `SCORED_PILLARS` |
| `src/app/(admin)/_components/charts/`                                       | `GroupedBars` / `SeriesKey` / `SERIES_COLORS`, `RowChart`, `LineChart`, `ChangeBadge`          |
| `src/lib/building-safety.ts`                                                | Pure functions: pooling, change, sections, most failed, comparison, `scopeFromParams`          |
| `src/lib/building-safety.test.ts`                                           | Tests for the above                                                                            |
| `src/lib/pillars.ts`                                                        | `PILLARS` (slug, name, label, icon) and `pillarHref`; slugs are the `DrrmPillar.code` values   |

## Data

- `Building` (`buildings`, active only) with its latest two `Assessment` rows via `loadBuildingScores` (`src/lib/assessment-records.ts`).
- `AssessmentPillarScore` (`assessment_pillar_scores`): the stored tallies the scores come from.
- `AssessmentAnswerRow` (`assessment_answers`, non-null `answer`) for section scores and most-failed items, joined in memory with `loadScoredItemMeta()`.
- `Campus`, `Cluster`, `Unit` for the breadcrumb; `AssessmentTemplateVersion` label for the history.
- `compareAssessments` re-scores both assessments from their answers, areas and floors with `scoreAssessment`.

## Server actions

`src/actions/building-safety/index.ts`. All take the access token and call `requireAdmin`:

- `getSafetyRollup(token, { campusId, clusterId, unitId })`: one drill level (`all`, `campus`, `cluster`, `unit`). Returns `SafetyRollup`: trail, pooled group, children, not-assessed buildings, sections, most failed. `null` when not an admin or the cluster/unit isn't in the caller's campus.
- `getBuildingHistory(token, buildingId)`: the building's assessments oldest first, numbered #1…#n, with version label. `null` when out of scope.
- `compareAssessments(token, aId, bId)`: two assessments of the same building, side by side. `null` unless both exist, share a building and are in scope.

## Pure logic (`src/lib/building-safety.ts`)

- `scoresFromPillarRows`, `pointsChange` (percentage points; `null` when either counted nothing).
- `poolBuildings`: sums tallies of each building's latest assessment (not an average of percents). `likeForLike` uses only buildings assessed at least twice. `pscp` counts the continuity plan (Recovery pillar `in_place`).
- `groupChildren(buildings, level)`: children of a level, each pooled, by name.
- `sectionScores(facts, ids)`, `mostFailed(facts, currentIds, perPillar = 5)`.
- `compareScores(a, b)`: overall, four pillars, sections matched by code; `versionsDiffer` flag. `comparePair` picks A/B, defaulting to previous vs latest.
- `scopeFromParams(params, { isSuperAdmin, switcherCampusId })`.

## Client side

- Shown on `/dashboard` (`BuildingSafety` in `src/app/(admin)/dashboard/page.tsx`).
- URL params: `bs_campus`, `bs_cluster`, `bs_unit`, `bs_building`, `bs_a`, `bs_b`. Drilling pushes a history entry (Back walks up); changing A/B picks replaces. Setting a level clears the levels under it.
- Hooks in `use-assessments.ts`: `useSafetyRollup`, `useBuildingHistory`, `useCompareAssessments`.
- Campus comes from `useScopedCampusId()` and `useIsSuperAdmin()`.
- More than 6 children: `RowChart` (one metric at a time). Otherwise `GroupedBars`.

## Rules and gotchas

- An Administrator's campus never comes from the URL: `scopeFromParams` returns `campusId: null` for them and the server uses their own.
- Drilling never moves the top-bar campus switcher. Changing the switcher clears all `bs_*` params and starts over.
- `bs_campus=all` means all campuses (Super Admin only).
- Recovery has one item, so it reads In place / Missing / N/A, not a percent. Only the three `SCORED_PILLARS` get percent bars.
- `percent()` never shows 100 while any answer is unsafe.
- Charts use the `--series-1…6` tokens from `globals.css`, print every value, and need no hover.
- Comparing across checklist versions matches sections by code; check `versionsDiffer`.
- Keep the arithmetic in `src/lib/building-safety.ts` and add tests there; components only render.

## Decisions

- [[0008-hand-built-charts]] the charts are hand-built in `(admin)/_components/charts`.
- [[0007-token-verified-actions]] every action scopes the campus with `requireAdmin`.
- [[0006-versioned-checklist-template]] comparisons load each assessment's own version.
- [[0001-server-actions-only]] the dashboard reads only through `src/actions/building-safety`.
