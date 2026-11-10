---
type: feature
ticket: DRRM-030
status: in-review
branch: feat/DRRM-030-event-report-timeline
modules:
  - '[[events]]'
tags: [plan, feature]
---

# [DRRM-030] Feature Plan: Timeline of reports on the event summary

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-030-event-report-timeline`
- **Owner / Author:** Bryan Mangapit

---

## 1. Problem Statement & Motivation

The NSED report (DRRM-019, DRRM-028) has a Timeline of Reports table: who reported, from which college or building, and when. The office wants the same table in the app, without exporting the report.

**Users:** Administrators and Super Admins, during a drill and afterwards.

---

## 2. Requirements & User Stories

- **As an admin**, I want to see the timeline of an event's reports on its page, so I can follow who has reported and when.
- Acceptance criteria:
  - [x] A "Timeline of reports" card on the event summary (event details and campus details): Name | College/Building | Time, first report first.
  - [x] The same rows as the NSED report: places named the same way ("PGH Zone 2", "Taft cluster" for a report with no unit).
  - [x] Follows the cluster drill-down; left out on a unit's page, which already lists its reports.
  - [x] First 5 rows, then Show all, like the other summary cards; a list on phones.

Not the main dashboard: the dashboard spans every event, and a timeline belongs to one.

---

## 3. Technical Design

- [src/app/(admin)/\_lib/summary.ts](<../../../src/app/(admin)/_lib/summary.ts>): `reportPlace(report)` and `reportTimeline(reports)` (pure, tested). The NSED report now uses them, so the card and the Word file agree.
- [src/app/(admin)/\_components/summary/sections.tsx](<../../../src/app/(admin)/_components/summary/sections.tsx>): `TimelineCard`, drawn like `MissingCard` (table on tablet and up, list on phones, `ShowAllFooter`).
- [src/app/(admin)/\_components/summary/event-summary.tsx](<../../../src/app/(admin)/_components/summary/event-summary.tsx>): the card after Clusters (or Units, in a cluster) and before Headcount, keyed by scope.
- No new server action or query: the summary source already carries each report's sender, cluster, unit and time.

---

## 4. Verification

- [x] `npm run test`: timeline order, names (and "—" for an account with no name), zone and no-unit places, a cluster scope.
- [x] Card checked on a preview page at 1100px and 375px: no overflow, Show all after 5 rows.
- [x] `npm run lint`, `npm run type-check`, `npm run build`.
