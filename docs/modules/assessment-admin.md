---
type: module
module: assessment-admin
updated: 2026-10-22
verified: true
paths:
  - src/actions/assessment-admin
  - src/app/(admin)/assessments
  - src/app/(print)/assessments
  - src/lib/assessment-records.ts
  - src/lib/admin-scope.ts
tags: [module]
---

# Assessments (admin pages)

Administrators and Super Admins read the building assessments that ERT members submit. `/assessments` has three tabs: Buildings (latest scores per building), Assessments (every submission) and Compare (one building's history and an A/B comparison). An Administrator only ever sees their own campus. Only a Super Admin can delete an assessment or open the checklist editor.

**Related:** [[architecture]] · [[assessments]] · [[building-safety]] · [[checklist-editor]] · [[campus-scoping]] · [[print]] · [[auth]] · [[routes]]

## Essentials

Read this before touching the admin assessment pages or their actions.

- **Actions:** admins read assessments through `src/actions/assessment-admin`: lists, detail, and a Super-Admin-only delete. Each action calls `requireAdmin(token, campusId)` (`src/lib/server-auth.ts` + `adminScope` in `src/lib/admin-scope.ts`). An Administrator gets their own campus whatever the request says, and a Super Admin the one asked for (or all) ([[0007-token-verified-actions]], [[campus-scoping]]).
- **Shared loaders:** the loaders the ERT and admin actions share are server-only, in `src/lib/assessment-records.ts`: the template version, `AssessmentRecord`, and buildings with their latest two scores. The score arithmetic (pillar rows, change in points) is in `src/lib/building-safety.ts` ([[building-safety]]).
- **Pages:**
  - `/assessments`, with Buildings | Assessments | Compare tabs.
  - `/assessments/details?id=`, reusing the ERT `AssessmentRecordBody`.
  - `/assessments/report?id=`, the A4 page in the `(print)` group, using the ERT `RecordPrint`.
  - The Super Admin checklist editor `/assessments/checklist` ([[checklist-editor]]).
- **Buildings** are fixed on the Settings → Buildings tab, the shared lookup table ([[settings-lookups]]).

## Where it lives

| Path                                                          | What it holds                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/actions/assessment-admin/index.ts`                       | List, building summaries, one record, delete                          |
| `src/app/(admin)/assessments/page.tsx`                        | Page header and the tabs; tab kept in `?tab=`                         |
| `src/app/(admin)/assessments/_components/buildings-tab.tsx`   | `BuildingsTab`: one row per active building, pillar scores and change |
| `src/app/(admin)/assessments/_components/assessments-tab.tsx` | `AssessmentsTab`: search, cluster, unit, From/To filters, 10 per page |
| `src/app/(admin)/assessments/_components/compare-tab.tsx`     | `CompareTab`: building picker; `?building=`, `?a=`, `?b=`             |
| `src/app/(admin)/assessments/_components/score-cell.tsx`      | `ScoreCell`, `RecoveryCell`                                           |
| `src/app/(admin)/assessments/details/page.tsx`                | `/assessments/details?id=`: read-only record, Print, Delete           |
| `src/app/(print)/assessments/report/page.tsx`                 | `/assessments/report?id=`: the A4 print                               |
| `src/lib/assessment-records.ts`                               | Server-only loaders shared with the ERT and dashboard actions         |
| `src/lib/admin-scope.ts`                                      | `adminScope`, `inScope`                                               |

## Data

- `Assessment` (`assessments`) with `AssessmentPillarScore` (`assessment_pillar_scores`), `evaluator` (`User`), `event` (`Event`).
- `Building` (`buildings`) through `Unit` → `Cluster` → `Campus` for scope and names.
- Deleting an `Assessment` cascades to `assessment_areas`, `assessment_answers`, `assessment_pillar_scores` and `assessment_section_comments` (`onDelete: Cascade` in the schema).
- `loadAssessmentRecord(where)` also loads the template version the assessment was answered with.

## Server actions

`src/actions/assessment-admin/index.ts`. Every action takes the access token and calls `requireAdmin(token, campusId)`:

- `getAssessmentList(token, campusId?)`: every submission in scope, newest first, capped at 1000 (`LIST_LIMIT`). The client filters and pages. `[]` when not an admin.
- `getBuildingSummaries(token, campusId?)`: active buildings in scope with their latest two assessments (`loadBuildingScores`).
- `getAssessment(token, id)`: one record; `null` when missing or at another campus (`inScope`).
- `deleteAssessment(token, id)`: Super Admin only (`scope.role === 'super_admin'`). Revalidates `/assessments` and `/dashboard`.

Shared loaders in `src/lib/assessment-records.ts`:

- `loadVersion(where)`: a checklist version as `AssessmentTemplate`, cached 60 s. `clearVersionCache()` empties it after template edits.
- `loadScoredItemMeta()`: item, section and pillar text by item id, cached, for the dashboard rollup.
- `loadAssessmentRecord(where)`: one submitted assessment as `AssessmentRecord`, plus `campus_id` and `building_id`.
- `scoredInclude`, `scoredSelect`, `toScoredAssessment(a)`: pillar rows to scores via `scoresFromPillarRows`.
- `loadBuildingScores(where)`: buildings by name with `latest`, `previous` and `assessment_count`.

## Client side

- Routes: `/assessments` (`?tab=buildings|assessments|compare`), `/assessments/details?id=`, `/assessments/report?id=` (in the `(print)` group, opens in a new tab).
- Hooks in `src/components/hooks/use-assessments.ts`: `useAssessmentList`, `useBuildingSummaries`, `useAdminAssessment`, `useDeleteAssessment` (invalidates `admin-assessments`, `building-summaries`, `building-safety`, `building-history`).
- Campus comes from `useScopedCampusId()`; `''` means all campuses and is sent as `null`.
- `useIsSuperAdmin()` shows the "Edit checklist" button and the Delete button.
- Reuses ERT components: `AssessmentRecordBody` (details page) and `RecordPrint` (report page) from `src/app/(ert)/assessment/_components/`.
- The Compare tab reuses `BuildingCompareView` from the dashboard's building-safety folder.

## Rules and gotchas

- The campus is decided on the server. `adminScope` gives an Administrator their own `campus_id` whatever the request says; a Super Admin gets the one asked for, or all (`null`).
- Out-of-scope records come back as `null`, so the details page shows "not found" rather than an error.
- The list loads at most 1000 rows; filters and the 10-row pages run on the client.
- `/assessments/checklist` is in `SUPER_ADMIN_HREFS` (`src/app/(admin)/_components/shell/nav.ts`); the admin shell blocks it for Administrators.
- Delete is permanent and removes answers and scores with it. The building and its profile stay.
- Scores shown here come from the stored `assessment_pillar_scores` snapshot, not a re-score.
- `assessment-records.ts` uses Prisma: import it from server actions only, never from components.

## Decisions

- [[0007-token-verified-actions]] every read calls `requireAdmin(token, campusId)` instead of trusting a client user id.
- [[0006-versioned-checklist-template]] a record is shown with the version it was answered with.
- [[0001-server-actions-only]] the pages read only through `src/actions/assessment-admin`.
- [[0008-hand-built-charts]] the Compare tab uses the hand-built line chart.
