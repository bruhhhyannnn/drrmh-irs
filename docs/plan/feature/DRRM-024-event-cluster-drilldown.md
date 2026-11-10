---
type: feature
ticket: DRRM-024
status: done
branch: feat/DRRM-024-event-cluster-drilldown
modules:
  - '[[events]]'
  - '[[campus-scoping]]'
tags: [plan, feature]
---

# DRRM-024 Feature RFC / Plan: Event cluster and unit drill-down

- **Status:** `[Done]` (merged in PR #93, 2026-11-05)
- **Target Branch / PR:** `feat/DRRM-024-event-cluster-drilldown`
- **Owner / Author:** DevJom

---

## 1. Problem Statement & Motivation

The Clusters card on an event's summary shows each cluster's reports, casualties and people, with one number per unit. It stops there:

- An admin can't open one cluster and see everything for it. Only Headcount and Missing have a cluster filter, and each one filters separately.
- An admin can't see a unit's headcount by field (Students, Faculty, …) or which reports it came from.
- Nothing lists the units that haven't reported. A cluster gets its green check on its first report, so a cluster with most of its units still silent looks finished.

**Users:** Administrators and Super Admins, during a drill or incident (who is missing, what's the count) and afterwards (reviewing one cluster or unit).

## 2. Goals, non-goals and anti-goals

### Goals

1. From the event page, an admin reaches one unit's detailed headcount in two clicks: cluster, then unit.
2. The numbers always agree: units add up to their cluster, and clusters add up to the event total.
3. Every active unit is accounted for, so anyone can see which units haven't reported, including all the units of a cluster with no reports.
4. A narrowed view has its own link, opens to the same cluster or unit, and works with the browser Back button.

### Non-goals

- Changing how reports are filed.
- Database schema changes.
- Reminders or notifications to units that haven't reported.
- Exporting a single cluster or unit to PDF or NSED.

### Anti-goals

The feature has failed, even if it technically works, if:

- numbers disagree between the full and narrowed views;
- someone mistakes a narrowed view for the whole event;
- a green check makes a cluster look finished while its units are still missing, with no sign of that nearby.

## 3. Decided behaviour

These were decided by the owner, using mockups, during design.

- **Narrowing, not a panel.** Clicking a cluster or unit narrows the whole event page to it, with a breadcrumb back. It doesn't expand in place or open a side drawer.
- **Clicking a cluster** shows that cluster's report: Overview, Headcount, Casualties, Missing and Analytics count only that cluster, and the Clusters card becomes the list of its units.
- **Clicking a unit** shows that unit's detailed headcount by field, then the list of reports from that unit.
- **Missing units sit under each cluster.** Each cluster has its own collapsed "2 units with no report yet" list, which starts collapsed. There is no single list across the card.
- **Several reports from one unit are added together.** Two members reporting 310 and 187 for College of Medicine make 497. This is how the summary already counts.
- **Reports on a completed event are read-only here.** A report opened from the unit view of a completed event can be read but not edited.

## 4. Calls made by the author

The owner saw these and raised no objection, but didn't decide them individually. Any of them can still be changed.

| Call                 | Behaviour                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Link                 | The narrowed view lives in the URL: `?id=<event>&cluster=<clusterId>&unit=<unitId>`. Each click is a history entry.                                                                                                                                                                                                                 |
| Compare              | Compare with last drill, and the compare charts, are hidden while narrowed, because they compare whole events.                                                                                                                                                                                                                      |
| Exports              | Export PDF and Export NSED report always export the whole event, including when clicked from a narrowed view.                                                                                                                                                                                                                       |
| Campus details       | `/campus/details` uses the same `EventSummary`, so it gets the same drill-down. There `id` is the campus, so the picked event moves from local state into an `event` param, keeping `defaultEvent` as the fallback. This keeps goal 4 true on this page. Changing event uses `router.replace`, so Back doesn't step through events. |
| No-report cluster    | A cluster with no reports (Taft) is still clickable. Its narrowed page shows zeros and its units, all listed as having no report yet.                                                                                                                                                                                               |
| Report row           | A row in the unit's report list opens the existing `ReportDrawer`: editable while the event isn't completed, read-only once it is.                                                                                                                                                                                                  |
| Read-only scope      | The lock applies to this drawer path only. `/reports` and `saveReportEdits` don't change, so an admin can still correct a closed event from the Reports page. Locking those is a separate ticket (see Risks).                                                                                                                       |
| No unit              | Reports without a unit appear as a clickable "No unit" row (`unit=none`), so they stay in the totals.                                                                                                                                                                                                                               |
| Deactivated units    | A deactivated unit with reports stays in the numbers and is clickable. It never appears in "no report yet".                                                                                                                                                                                                                         |
| Units added later    | On a completed event, a unit created after the event ended isn't listed as "no report yet".                                                                                                                                                                                                                                         |
| Green check          | The check still means "at least one report". The row gains "4 of 6 units" beside the name, so a partial cluster reads as partial.                                                                                                                                                                                                   |
| Unit-level sections  | A unit shows Overview, Headcount, Reports from this unit, Casualties and Missing. Analytics is left out, as one or two reports make no useful chart.                                                                                                                                                                                |
| Bad link             | A `cluster` that isn't in this event's reports or its campus's active clusters, or a `unit` that isn't in that cluster or its reports, shows the whole event with a short note, not an error.                                                                                                                                       |
| Unit with no reports | A real unit with no reports in this event is a valid view with zeros, matching a no-report cluster. This happens when a report is moved to another unit, or from an old link. Its row in the card stays plain text.                                                                                                                 |

## 5. Architecture & Technical Design

### Data Model & Prisma

No schema change, no manual SQL.

### Server Actions & Data Flow

`getEventSummarySource` ([src/actions/events/index.ts](../../../src/actions/events/index.ts)) adds each active cluster's active units to its `clusters` select:

```ts
units: {
  where: { is_active: true },
  select: { id: true, name: true, created_at: true },
  orderBy: { name: 'asc' },
},
```

Everything else is client-side from data already loaded. There is no new request per click, which also means narrowed views stay in step with the full view by construction.

### Summary model

Narrowing is one new pure function in [src/app/(admin)/\_lib/summary.ts](<../../../src/app/(admin)/_lib/summary.ts>), not a set of filters in each card:

```ts
scopeSource(source, { clusterId, unitId }): SummarySource
```

It returns the source with `reports` filtered to the scope and `clusters` narrowed to that cluster, and `buildSummary` runs on it unchanged. Because every section reads the same `Summary`, goal 2 and the first anti-goal hold by construction. `unitId` of `none` matches reports with a null `unit_id`.

`ClusterRow.units` gains the unit's `id` (`null` for No unit). `Summary.clusters.pending` and `ClusterRow` gain the cluster's unit coverage:

- `unitsTotal`: the active units, minus units created after `ended_at` on a completed event.
- `unitsReported`: how many of those have at least one report.
- `unitsMissing`: the rest, by name, sorted by name.

"No unit" and deactivated units count in the numbers but not in coverage. A cluster with no active units shows no "x of y" label. A cluster that reports but is itself inactive isn't in `source.clusters`, so it also has no coverage data and shows no label or missing list, while its numbers stay. A scope pointing at such a cluster must still work.

`buildSummary` is also called by the report PDF and read by NSED. Both keep getting the unscoped source.

### Client side

- `EventSummary` reads `cluster` and `unit` from `useSearchParams()` and passes the scoped source to `useSummary`. Navigation uses `router.push`, keeping every other query param, including the campus page's own.
- The campus page's event picker sets `event` and clears `cluster` and `unit` when the event changes.
- The Headcount and Missing cluster filters are hidden while narrowed, as they would be redundant.
- Reports tile: `From x of y clusters` becomes a unit-based line when narrowed.
- First report by cluster is hidden when narrowed, as it would have a single bar.
- `useEventSummarySource` is unchanged. Report mutations in `use-reports.ts` already invalidate `['event-summary']`, so the numbers refresh after the drawer saves.

### UI

- **Breadcrumb:** `Event name › Pedro Gil › College of Medicine`, above Overview. Earlier parts are links; the last is plain text with `aria-current="page"`.
- **Always-visible scope:** the Overview subtitle names the cluster or unit, so a screenshot or a scrolled page can't read as the whole event (anti-goal 2).
- **Clusters card, full event:** cluster name and unit rows become links with a hover state and `FOCUS_RING`, in both the table (`md` and up) and the phone list. Real anchors, so open-in-new-tab works. Under each cluster, a `<button aria-expanded>` toggles its missing units. Rows for units with no report are plain text, not links.
- **Cluster view:** the card becomes "Units in Pedro Gil" with the same rows and missing list.
- **Unit view:** the card is replaced by "Reports from this unit": time, reporter, people count. Rows open `ReportDrawer`.
- **Read-only drawer:** `ReportDrawer` gains a `readOnly` prop, passed when the event is completed. It shows the report as text instead of the form, so nothing can be saved, with photos and casualty and missing details still visible. The title reads "Report" and the footer has only Close.
- Theme tokens only, no `dark:` variants; check light and dark.

### Files

| File                                                              | Change                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| `src/actions/events/index.ts`                                     | Active units on `clusters`                              |
| `src/app/(admin)/_lib/summary.ts`                                 | `scopeSource`, unit ids, coverage                       |
| `src/app/(admin)/_lib/summary.test.ts` (new)                      | Tests below                                             |
| `src/app/(admin)/_components/summary/event-summary.tsx`           | URL scope, breadcrumb, hiding Compare                   |
| `src/app/(admin)/_components/summary/sections.tsx`                | Links, missing lists, unit report list, hiding filters  |
| `src/app/(admin)/campus/details/page.tsx`                         | Picked event in the URL; clear scope on event change    |
| `src/app/(admin)/reports/_components/report-drawer.tsx`           | `readOnly` prop                                         |
| `src/app/(admin)/reports/_components/report-details.tsx` (new)    | Read-only report view                                   |
| `src/app/(admin)/_components/summary/drill-down.tsx` (new)        | Breadcrumb, units card, unit reports card, missing list |
| `src/app/(admin)/_lib/nsed-report.test.ts`                        | Fixture gains `units` if the type requires it           |
| `docs/modules/events.md`, `docs/00-index.md`, `docs/changelog.md` | Behaviour, plan row, changelog on merge                 |

## 6. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a cluster or unit narrows the event summary to it, and each cluster lists its units with no report yet.

**Architecture:** The scope lives in the URL. `resolveScope` validates it, `scopeSource` filters the source, and the unchanged `buildSummary` builds the narrowed page, so every section agrees. The Clusters card, breadcrumb and read-only drawer are thin UI on top.

**Tech Stack:** Next.js App Router (`useSearchParams`, `usePathname`, `next/link`), TanStack Query, Prisma, `node:test` via tsx.

**Spec:** Sections 1 to 5 of this document.

### Global Constraints

- No schema change. Never run `prisma db push`, `migrate dev` or `migrate reset`.
- Components never call Prisma. All new data comes through `getEventSummarySource`.
- Theme tokens only, no `dark:` variants: `bg-surface`, `border-line`, `FOCUS_RING` on every new link and button.
- Exact copy: "2 units with no report yet" (`plural`), "No unit", "Units in {cluster}", "Reports from this unit", "4 of 6 units".
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Review Focus

1. A narrowed page of a completed event: the Completed banner still names the whole event's missing clusters, not the scoped ones. (Task 3 browser step)
2. A link whose report has since been moved or deleted: a real unit opens with zeros, and an unknown one falls back to the whole event with the note. (Task 1 tests)
3. A completed event that is reopened, with or without an `ended_at`: all active units are expected again and its reports are editable again. (Task 1 test, Task 4 browser step)
4. A unit whose only report counts 0 people: it has reported, so it is not in the missing list. (Task 1 test)
5. "No unit" reports in two clusters: narrowing one never pulls in the other's. (Task 1 test)

### Task 1: Summary model

**Files:**

- Create: `src/app/(admin)/_lib/summary.test.ts`
- Modify: `src/app/(admin)/_lib/summary.ts`, `src/actions/events/index.ts:237-241`
- Modify: `src/app/(admin)/_lib/nsed-report.test.ts:19-24` (each cluster gains `units: []`)

**Interfaces:**

- Produces, from `summary.ts`:
  - `NO_UNIT = 'none'`
  - `UnitCoverage { total: number; reported: number; missing: { id: string; name: string }[] }`
  - `SummaryScope { clusterId: string; clusterName: string; unitId: string | null; unitName: string | null }`
  - `scopeSource(source: SummarySource, scope: Pick<SummaryScope, 'clusterId' | 'unitId'>): SummarySource`
  - `resolveScope(source: SummarySource, params: { cluster: string | null; unit: string | null }): { scope: SummaryScope | null; invalid: boolean }`
  - `ScopeTarget { clusterId: string | null; unitId?: string | null }`
  - `scopeHref(pathname: string, params: { toString(): string }, target: ScopeTarget, pins?: Record<string, string>): string`
  - `scopedCoverage(summary: Summary): UnitCoverage | null`, the coverage of a summary narrowed to one cluster
  - `peopleOf` (now exported)
  - `ClusterRow.units[].id: string | null`, `ClusterRow.coverage: UnitCoverage | null`
  - `Summary.clusters.pending[]` gains `coverage: UnitCoverage | null`

- [ ] **Step 1: Make `summary.ts` loadable in tests.** Import `personMeta` from `@/components/ds/people` rather than the `@/components/ds` barrel, which pulls in the Supabase client and fails under the test runner with "supabaseUrl is required". Import `PersonSex` from wherever it is declared, type-only.

- [ ] **Step 2: Write the failing tests** in `summary.test.ts`, with local `report(clusterId, unitId, counts, extra?)` and `source(reports, event?)` fixtures in the style of `nsed-report.test.ts`. Clusters: `pg` (units `med`, `cams`, `nur`), `taft` (unit `cph`), `shs` (no units).

| Test name                                                      | Assertion                                                                                                                                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adds several reports from one unit`                           | Reports of 310 and 187 for `med`: the row's `med` unit has `people === 497`.                                                                                                                    |
| `units add up to clusters and clusters to the event`           | Sum of `units[].people` equals each row's `people`; sum of rows equals `totals.people`, with a No unit report included.                                                                         |
| `scopes to a cluster`                                          | `buildSummary(scopeSource(s, { clusterId: 'pg', unitId: null }), lists)`: `totals` count only `pg`; `clusters.total === 1`.                                                                     |
| `scopes to a unit`                                             | With `unitId: 'med'`: `totals.reports === 2`, `totals.people === 497`.                                                                                                                          |
| `no unit stays inside its cluster`                             | With `unitId: NO_UNIT` on `pg`: only `pg`'s report with a null `unit_id`, not `taft`'s.                                                                                                         |
| `coverage counts active units`                                 | `pg` row `coverage` is `{ total: 3, reported: 2, missing: [{ id: 'nur', name: 'Nursing' }] }`.                                                                                                  |
| `coverage counts a report of zero people`                      | A `nur` report with count 0: `nur` isn't in `missing`.                                                                                                                                          |
| `coverage ignores no unit and deactivated units`               | A No unit report and a report for a unit not in `units` leave `reported` unchanged, but their people stay in `totals`.                                                                          |
| `coverage is null without expected units`                      | `shs` has `coverage === null`; so does a reporting cluster missing from `source.clusters`.                                                                                                      |
| `pending clusters list all units`                              | `taft` in `pending`: `coverage.missing` holds `cph`, `reported === 0`.                                                                                                                          |
| `units added after a completed event are not expected`         | Completed event, unit `created_at` after `ended_at`: not in `total`. On an ongoing event, or completed with `ended_at: null`: included.                                                         |
| `resolves a valid scope`                                       | `{ cluster: 'pg', unit: 'med' }` gives names and `invalid: false`; `{ cluster: null, unit: null }` gives `{ scope: null, invalid: false }`.                                                     |
| `falls back on a bad link`                                     | Each gives `{ scope: null, invalid: true }`: unknown cluster; `unit` with no `cluster`; a unit of another cluster; `NO_UNIT` with no such report.                                               |
| `accepts a real unit or cluster with no reports`               | `{ cluster: 'pg', unit: 'nur' }` and `{ cluster: 'taft', unit: null }` are valid, and their summaries total 0.                                                                                  |
| `accepts inactive clusters and deactivated units with reports` | Found from `source.reports`, with names from the report.                                                                                                                                        |
| `builds scope links`                                           | From `?id=e1&cluster=pg&unit=med`, `{ clusterId: 'pg' }` gives `/events/details?id=e1&cluster=pg`; `{ clusterId: null }` gives `/events/details?id=e1`; `pins { event: 'e2' }` sets `event=e2`. |

- [ ] **Step 3: Run the tests.** `npx tsx --test "src/app/(admin)/_lib/summary.test.ts"`. Expected: FAIL, as the functions don't exist.

- [ ] **Step 4: Add the units to `getEventSummarySource`** using the `units` select in section 5, and `units: []` to the `nsed-report.test.ts` fixture.

- [ ] **Step 5: Implement the interfaces above in `summary.ts`.** Expected units for a cluster: its `units`, leaving out `created_at > event.ended_at` when `completed && event.ended_at`. `reported` counts expected units with a report, by `unit_id`. Coverage is `null` when the cluster isn't in `source.clusters` or has no expected units. `missing` keeps the name order from the query. `scopeSource` narrows `reports` and `clusters` and returns the rest unchanged. `scopedCoverage` reads `done[0]?.coverage ?? pending[0]?.coverage ?? null`.

- [ ] **Step 6: Run everything.** `npm run test` and `npm run type-check`. Expected: PASS.

- [ ] **Step 7: Commit** with `feat(events): scope the event summary to a cluster or unit (DRRM-024)`.

### Task 2: Clickable Clusters card with missing units

**Files:**

- Create: `src/app/(admin)/_components/summary/drill-down.tsx`
- Modify: `src/app/(admin)/_components/summary/event-summary.tsx`, `src/app/(admin)/_components/summary/sections.tsx:158-325`

**Interfaces:**

- Consumes: `scopeHref`, `ScopeTarget`, `UnitCoverage`, `ClusterRow.units[].id`
- Produces, from `drill-down.tsx`: `type ScopeLinks = (target: ScopeTarget) => string`, and `MissingUnits({ coverage, className? }: { coverage: UnitCoverage | null; className?: string })`
- `ClustersCard({ summary, links }: { summary: Summary; links: ScopeLinks })`
- `EventSummary` gains the prop `linkParams?: Record<string, string>`

- [ ] **Step 1: `MissingUnits`.** Renders nothing if `coverage` is null or `missing` is empty. A `<button type="button" aria-expanded>` reading `plural(n, 'unit', 'units') + ' with no report yet'`, with a chevron, starts collapsed and toggles a plain list of names.

- [ ] **Step 2: `links` in `EventSummary`.** `usePathname` and `useSearchParams` build `links = (target) => scopeHref(pathname, searchParams, target, linkParams)`, passed to `ClustersCard`.

- [ ] **Step 3: Rows in `ClustersCard`, in both the table and the phone list.** Each cluster name and each unit name becomes a `next/link` with a stretched target (`relative` row, `after:absolute after:inset-0` on the link), `hover:bg-gray-50`, `FOCUS_RING`, and a small chevron so it reads as clickable. Unit `id: null` links with `NO_UNIT`. Pending clusters link too. Beside the cluster name, when coverage exists, show `{reported} of {plural(total, 'unit', 'units')}` in the existing muted style. `MissingUnits` goes below each cluster's unit rows, and below each pending row, outside the stretched link.

- [ ] **Step 4: Check it.** `npm run lint`, `npm run type-check`. In the browser as Administrator (`test-accounts.local.md`), with `npm run dev`: at phone and desktop widths, rows go to `?id=…&cluster=…` and `&unit=…`, the list toggles with Enter and Space, and the page is unchanged for now apart from the URL.

- [ ] **Step 5: Commit** with `feat(events): link clusters and units, list units with no report (DRRM-024)`.

### Task 3: Narrowed cluster and unit views

**Files:**

- Modify: `src/app/(admin)/_components/summary/event-summary.tsx`, `src/app/(admin)/_components/summary/sections.tsx`, `src/app/(admin)/_components/summary/drill-down.tsx`

**Interfaces:**

- Consumes: `resolveScope`, `scopeSource`, `scopedCoverage`, `peopleOf`, `ScopeLinks`, `MissingUnits`
- Produces, from `drill-down.tsx`: `ScopeBreadcrumb({ title, scope, links })`, `UnitsCard({ summary, scope, links })`, `UnitReportsCard({ summary })`
- `OverviewTiles({ summary, scope? })`, `HeadcountCard({ summary, scoped? })`, `AnalyticsGrid({ summary, scoped? })`

- [ ] **Step 1: Two summaries in `EventSummary`.** `resolveScope(source, { cluster, unit })` from the URL, memoised. `useSummary(source)` stays the full summary, and a second `useSummary(scope ? scopeSource(source, scope) : null)` is the narrowed one. Sections read `view = narrowed ?? summary`. `CompletedBanner` always gets the full `summary`.

- [ ] **Step 2: The frame.** When narrowed, `ScopeBreadcrumb` sits above Overview: an `<nav aria-label="Breadcrumb">` of event title › cluster › unit, earlier parts linked and the last with `aria-current="page"`. Overview and Analytics subtitles add the scope name after `title`. When `invalid`, show `That cluster or unit isn't part of this event, so the whole event is shown.` above Overview. Compare with last drill and its charts render only when not narrowed.

- [ ] **Step 3: Sections by view.**

| Section             | Full event     | Cluster              | Unit              |
| ------------------- | -------------- | -------------------- | ----------------- |
| Clusters card       | `ClustersCard` | `UnitsCard`          | `UnitReportsCard` |
| Headcount           | with filter    | no filter            | no filter         |
| Casualties, Missing | yes            | yes                  | yes               |
| Analytics           | yes            | without First report | hidden            |

`UnitsCard` is headed "Units in {cluster}" with reported and total, then a row per `done[0]?.units` linked like Task 2, then `MissingUnits`, using `scopedCoverage`. With no reports it shows only the missing list. `UnitReportsCard` is headed "Reports from this unit": newest first, time (`formatTime`), reporter (`personName`), people (`peopleOf`), or "No reports from this unit in this event." when empty. Its row action is added in Task 4.

- [ ] **Step 4: Tiles.** With `scope`: Total affected's sub is `In {unitName ?? clusterName}`. Reports' sub is `From this unit` for a unit, `From {reported} of {plural(total, 'unit', 'units')}` for a cluster with coverage, otherwise `From this cluster`.

- [ ] **Step 5: Check it.** `npm run lint`, `npm run type-check`, then in the browser:
  - Pedro Gil's tiles, Headcount, Casualties and Missing match its row in the full view, and College of Medicine's headcount total matches its row.
  - Back returns one step at a time, and a copied narrowed link opens the same view in a new tab.
  - A made-up `cluster=` shows the whole event with the note.
  - On a completed event narrowed to one cluster, the banner still names the whole event's missing clusters.
  - Compare is hidden when narrowed and back on return.
  - Export PDF from a narrowed view gives the whole event.

- [ ] **Step 6: Commit** with `feat(events): narrow the summary to a cluster or unit (DRRM-024)`.

### Task 4: Open reports, read-only on completed events

**Files:**

- Create: `src/app/(admin)/reports/_components/report-details.tsx`
- Modify: `src/app/(admin)/reports/_components/report-drawer.tsx:69-125`, `src/app/(admin)/_components/summary/drill-down.tsx`

**Interfaces:**

- Consumes: `useReport`, `ReportPhotos`, `UnitReportsCard`
- Produces: `ReportDrawer` prop `readOnly?: boolean`; `ReportDetails({ report }: { report: Report })`, where `Report` is the drawer's existing type, exported

- [ ] **Step 1: `ReportDetails`.** A text view in `DrawerSection`s, with no form and no save path: Where (cluster, unit, `location_name`), Headcount (`population_counts`), People affected (casualty name, condition, diagnosis; missing name and details via `personMeta`), Structural damage, and `ReportPhotos` as in the form.

- [ ] **Step 2: `readOnly` in `ReportDrawer`.** When set: title `Report`, footer with a single Close button, body `ReportDetails` in place of `ReportForm`.

- [ ] **Step 3: Rows open it.** In `UnitReportsCard`, each row is a `<button>` that opens `ReportDrawer` with `reportId`, `campusId={event.campus_id}` and `readOnly={summary.completed}`, with `{ open, reportId }` state as on `/reports`.

- [ ] **Step 4: Check it.** `npm run lint`, `npm run type-check`, then in the browser:
  - On an ongoing event, edit a report from the unit view, and the numbers update.
  - On a completed event, the same row opens read-only, with photos and people visible and nothing to save.
  - Reopen that event: the same row is editable, and the unit's missing list includes units created since.
  - `/reports` still edits as before.

- [ ] **Step 5: Commit** with `feat(events): open a unit's reports, read-only once completed (DRRM-024)`.

### Task 5: Campus details and docs

**Files:**

- Modify: `src/app/(admin)/campus/details/page.tsx:44,69,118-135`
- Modify: `docs/modules/events.md`, `docs/00-index.md`, `docs/changelog.md`, this document's status

**Interfaces:**

- Consumes: `EventSummary`'s `linkParams`

- [ ] **Step 1: Event in the URL.** Remove `pickedId`. `selected = events.find((e) => e.id === searchParams.get('event')) ?? defaultEvent(events)`. The picker calls `router.replace` with `event` set and `cluster` and `unit` removed, keeping `id`, with `{ scroll: false }`. Pass `linkParams={{ event: selected.id }}`.

- [ ] **Step 2: Docs.** In `events.md`: the drill-down, the URL params, `scopeSource` and the read-only drawer, and set `updated`. Add the plan row to Active in `00-index.md`, and a line to `changelog.md`. Note the `readOnly` prop in `field-reports.md`.

- [ ] **Step 3: Full verification.** `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`. Expected: all pass. Then as Super Admin on `/campus/details`: pick an event that isn't the default, click a cluster and a unit, and open the copied link in a new tab, which shows the same event. Changing event clears the scope, and Back doesn't step through events.

- [ ] **Step 4: Check dark mode** on the Clusters card, breadcrumb, unit view and read-only drawer at phone and desktop widths.

- [ ] **Step 5: Commit** with `feat(campus): keep the picked event in the link (DRRM-024)`.

## 7. Verification & Rollout Plan

**Automated (`npm run test`), in `summary.test.ts`:**

- Units sum to their cluster, and clusters to the event, including several reports from one unit and a No unit report.
- `scopeSource` to a cluster and to a unit, and `buildSummary` on the result.
- `unit=none`; an unknown cluster or unit; a cluster with no reports; a real unit with no reports; an inactive cluster with reports.
- Coverage: deactivated units, units created after a completed event ended, a cluster with no active units.

**Commands:** `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`.

**In the browser, as Administrator and Super Admin:**

- Click a cluster, then a unit; Back returns one step at a time.
- Copy a narrowed link into a new tab; it opens the same view.
- The missing list opens and closes with the keyboard, on phone and desktop widths.
- On an ongoing event, open a report from the unit's list, save it, and see the numbers update.
- On a completed event, the same report opens read-only, with nothing to save.
- Export PDF from a narrowed view gives the whole event.
- Do the same on `/campus/details`, and change the event there.

## 8. Risks and limits

- **Typed units inflate the list.** Unit → Other (please specify) adds a real unit to the cluster, so a one-off typed name becomes an expected unit in later events and shows as "no report yet" until an admin deactivates it in Settings.
- **Current units, not units at the time.** A unit deactivated after an event no longer shows as missing on that event. Only units created after the event are handled.
- **Adding is not deduplicating.** If two members count the same people for one unit, the unit's number is high. The owner chose to add, and the report list makes both reports visible.
- **No live refresh.** Like today, the summary updates on refetch or after saves here, not while an admin watches. Out of scope.
- **Completed reports aren't fully locked.** The banner says "Reports are locked", but `saveReportEdits` doesn't check the event's status, and `/reports` can still edit them. This ticket only stops edits from the unit view.
