---
type: fix
ticket: DRRM-048
status: done
branch: fix/DRRM-048-db-concurrency-performance
modules:
  - '[[database]]'
  - '[[assessments]]'
  - '[[checklist-editor]]'
tags: [plan, fix, database]
---

# [DRRM-048] Fix Plan: Database: RLS, indexes, races

- **Status:** `[Done]`
- **Related Bugs / Audits:** GitHub #108 (items 1 to 3), #109
- **Target Branch / PR:** `fix/DRRM-048-db-concurrency-performance`
- **Author:** Bryan Mangapit

---

## 1. Objective & Scope

From the concurrency tests and the database review:

- `createAssessment` failed with `P2002` on `building_areas_pkey` when two assessments of one
  building were submitted at once, and an older offline assessment synced late overwrote the
  building's newer profile (#108 item 1).
- `unitIdForName` and `positionIdForName` threw on a concurrent `P2002`, and case variants could
  both be inserted (#108 item 2).
- Sections, questions and area types added at once got the same `sort_order` (#108 item 3).
- 19 tables had no RLS in versioned SQL, so the browser's publishable key could reach them over
  the REST API; foreign keys and list filters lacked indexes; the pool used pg's default of 10
  connections; re-numbering ran one update per row inside a transaction (#109).

Already done elsewhere: one report per member and the event lock (#108 items 4 and 5,
DRRM-046); `addCampusPopulationCategory`'s place lock, the dashboard's bounded events query and
the bystander list cap (#108 item 3 and #109 item 4, DRRM-047).

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [x] `src/actions/assessments`: inside the transaction, lock the building row
      (`SELECT … FOR UPDATE`), then rewrite `building_areas` and `floor_count` only when this
      assessment's `ended_at` is at least the newest one's (`isNewestAssessment` in
      `src/lib/building-profile.ts`). The transaction sets an explicit `{ maxWait: 5 s, timeout: 15 s }`,
      because the submits for one building queue on that row lock and the 5 s default would fail the
      later ones (P2028).
- [x] `src/lib/lookup-names.ts`: `findOrCreate` (now in `src/lib/find-or-create.ts`, so it can be
      tested without a database) reuses the row someone added a moment ago on a `P2002`, for units
      and positions as it already did for clusters.
- [x] `src/actions/assessment-templates`: a new section locks its version row, a new or deleted
      question its section row, a deleted section its version row; a new area type takes
      `pg_advisory_xact_lock`. `setSortOrders` writes the changed places in one
      `UPDATE … FROM (VALUES …)`. Structural edits re-read the version (or the question's section)
      status after taking the lock and refuse with the usual "draft only" message if a publish got
      there first. `reorderSection` and `reorderItem` take the same lock and write through
      `setSortOrders` with `movedItems` (now in `src/lib/assessment-template.ts`), so re-numbering
      is the same everywhere in the file.
- [x] `src/lib/prisma.ts`: `max: 5`, `idleTimeoutMillis: 10_000`.

### 2.2 Database / Prisma

- [x] `prisma/manual/DRRM-048-rls-indexes-lookups.sql` (idempotent):
  - RLS on every `public` table that lacks it, and a NOTICE for any existing policy to review.
  - Indexes: users (campus + created, unit, user type), clusters (campus + active), units
    (cluster + active), events (campus + status + started, status + started), reports (event +
    submitted, cluster + submitted, event + user, unit), bystander reports (cluster + submitted,
    status + submitted).
  - `uq_units_cluster_lower_name` and `uq_positions_lower_name`, created only when no
    case-variant duplicates exist (otherwise a NOTICE lists them).
- [x] `prisma/schema.prisma`: the matching `@@index` lines (the `lower(name)` indexes are
      SQL-only).

The code works with or without the SQL; run it on staging and production soon, because the RLS
step is what closes the REST API.

---

## 3. Verification

- Unit tests (`npm run test`): `src/lib/find-or-create.test.ts` (returns the existing row, creates one,
  re-finds on `P2002`, rethrows when the re-find is empty and on any other error),
  `src/lib/building-profile.test.ts` (no earlier assessment, newer, equal, older) and `movedItems`
  in `src/lib/assessment-template.test.ts` (returns only the rows whose place changed).
- [x] `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`, `prisma validate`
- [ ] Apply the SQL on staging; the "AFTER" query in the file shows RLS on every table, and
      `/rest/v1/reports?select=*` with the publishable key returns nothing.
- [ ] Submit two assessments of one building at once (both land); sync an older offline one after
      a newer one (the building keeps the newer floors and areas).
- [ ] Checklist editor: add, delete and reorder sections and questions; add an area type.

## 4. Follow-up (not in this PR)

- Drop the single-column indexes now covered by the new composite ones: `Report @@index([event_id])`,
  `Report @@index([cluster_id])` and `bystander_reports @@index([status_id])` in
  `prisma/schema.prisma` (each one only adds write cost now).
