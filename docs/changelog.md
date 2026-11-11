---
type: reference
tags: [changelog]
---

# Changelog

What changed, newest first, grouped by ticket. Built from the git history up to `6072713` (2026-11-08). The only tag is `v0.0.1`, so entries are grouped by ticket, not by release. When a ticket merges, add an entry here and set its plan to `done`.

**Related:** [[00-index]] · [[conventions]]

## DRRM-034 Photos in the admin Add / Edit report drawer: 2026-11-11 (branch `feat/DRRM-034-admin-report-photos`)

Plan: [[plan/feature/DRRM-034-admin-report-photos]] · [[field-reports]]

- Admins can attach photos of the structural damage and of each casualty's injury when adding or editing a report, as ERT members do. Edit shows the saved photos with remove buttons and deletes a removed one only when the report saves. The casualty and missing persons drawers have an Edit button per person.
## DRRM-033 PageHeader ⋯ menu: 2026-11-11 (branch `feat/DRRM-033-page-header-menu`)

Plan: [[plan/feature/DRRM-033-page-header-menu]] · [[design-system]] · [[events]]

- Page headers keep the often-used actions as buttons (exports, Add …, Complete event) and put Edit, Delete and other rare ones behind a ⋯ More actions button: a dropdown on tablet and web, a bottom sheet on phone. Event details, campus details, Assessments, assessment details and the checklist editor use it. Event details shows the campus logo beside the title, and Population fields in the campus ⋯ opens Settings on that campus.

## DRRM-032 NSED report for PGH and UP Diliman: 2026-11-10 (branch `feat/DRRM-032-nsed-report-pgh-diliman`)

Plan: [[plan/feature/DRRM-032-nsed-report-pgh-diliman]] · [[events]]

- PGH events can export the NSED report too, on the UP Manila office's template.
- UP Diliman events export UPRI's NSED report: the drill date, the counts in the executive summary and a table of the clusters and units that reported (with a header row, a Missing column, cluster totals and a grand total), including missing persons, are filled in; the signatories, observations, comparison with the last quarter and screenshots are yellow blanks for UPRI.

## DRRM-031 Headcount by category chart on the event summary: 2026-11-10 (branch `feat/DRRM-031-headcount-by-unit-chart`)

Plan: [[plan/feature/DRRM-031-headcount-by-unit-chart]] · [[events]]

- The Headcount card on event details and campus details shows the NSED report's chart: a stacked bar per unit by category, then missing persons and casualties, with each bar's total, grouped by cluster. The legend gives each category's total. It replaces the per-field bars and the cluster picker; the cluster drill-down narrows it.

## DRRM-030 Timeline of reports on the event summary: 2026-11-09 (branch `feat/DRRM-030-event-report-timeline`)

Plan: [[plan/feature/DRRM-030-event-report-timeline]] · [[events]]

- Event details and campus details show a Timeline of reports card: who reported, from which college or building, and when, first report first, the same rows as the NSED report's timeline. It follows the cluster drill-down.

## DRRM-028 NSED report v2: 2026-11-09 (branch `feat/DRRM-028-nsed-report-v2`)

Plan: [[plan/feature/DRRM-028-nsed-report-v2]] · [[events]]

- The NSED report follows the office's official report: an Executive Summary heading with a blank to write it, an observers' comments table, a Structural damage column in the headcount summary, breakdown tables with a row per unit and a column per personnel category (then Missing and Casualty, with a Total row), and the comparison of what reached the Incident Commander with what was sent through the IRS.
- The headcount by category is a native Word chart: stacked bars per unit, a colour per category, the total at each bar's end.
- Names in the notes are written with a capital first letter, the timeline's College/Building and Time are centred, and table text is 12 pt.

## DRRM-027 Pillar page redesign: 2026-11-06 (PR #96, merged 2026-11-08)

Plan: [[plan/feature/DRRM-027-pillar-page-redesign]] · [[pillars-and-landing]]

- Redesigns the DRRM pillar pages (`/pillars/<slug>`) with a single view at a time (Campus vs Off-campus in `?view=`) and a Super Admin campus picker (writing `useCampusScopeStore`).
- Sections structured in decision order: 1. How are we doing (pooled score tile with change pts, buildings assessed, need follow-up, answered N/A rate), 2. What to fix first (full-width failing checklist items with building drill-down), 3. Buildings to visit (lowest scores with follow-up tags and dates), 4. Where it's weakest (places table with change).
- Adds five focused charts: quarterly score trend (Chart A, Campus vs Off-campus), score bands (Chart B, with building drill-down and no-score count), better/same/worse change bar (Chart C, with drill-down), section scores as bars (Chart D, lowest first), and monthly activity with overdue building tracking (Chart E).
- Dedicated view for Rehabilitation and Recovery with continuity plan counts, plan change tracking, missing plan building list, and quarterly adoption trend.

## DRRM-026 Off-campus accounts: 2026-11-06 (PR #95, merged 2026-11-08)

Plan: [[plan/feature/DRRM-026-off-campus-accounts]]

- A Super Admin makes off-campus ERT accounts with an email and password ([[users]]). They set up their own name, address, organization and position, with a data privacy consent ([[auth]]), and have no Report tool.
- Their assessments are always off campus and belong to no campus, so only Super Admins see them ([[assessments]], [[campus-scoping]]). Schema in `prisma/manual/DRRM-026-off-campus-accounts.sql` ([[database]]).

## DRRM-025 Off-campus building assessments: 2026-11-05 (PR #94, merged 2026-11-08)

Plan: [[plan/feature/DRRM-025-off-campus-assessment]]

- **ERT form** ([[assessments]], [[offline-pwa]]): an On campus / Off campus choice on the Details step, PSGC location dropdowns that work offline, and an optional map pin. Schema in `prisma/manual/DRRM-025-off-campus-buildings.sql` ([[0010-off-campus-buildings]]).
- **Admins** ([[building-safety]], [[assessment-admin]]): a Campuses | Off-campus switch on the dashboard with a drill-down by location, and a category filter on the Assessments tabs. Off-campus results never count toward a campus score.
- **Pillar pages** ([[pillars-and-landing]]): the placeholders become each pillar's results, Campus beside Off-campus, including the N/A rate, and `/pillars` is a new overview.

## DRRM-024 Event cluster and unit drill-down: 2026-11-05 (PR #93)

[[plan/feature/DRRM-024-event-cluster-drilldown]] · [[events]]

- Clicking a cluster or unit on an event's summary narrows the whole page to it, with its own link. Each cluster lists its units with no report yet, and a unit's page lists its reports, read-only once the event is completed.

## DRRM-023 Report 500s, sign-in loader, role routing: 2026-11-04 (PR #92)

Plans: [[plan/fix/DRRM-023-report-500-and-role-routing]] · [[plan/bugs/DRRM-023-report-500-and-role-routing]] · [[auth]] · [[routes]] · [[field-reports]]

- Status reports save on production again, every sign-in ends in a page or an error with a way out, and non-admins no longer mount admin pages.

## DRRM-022 Photos on field reports: 2026-11-03 (PRs #89, #90)

Plans: [[plan/feature/DRRM-022-report-photos]] · [[plan/review/2026-10-29-pr-89-report-photos]] · [[field-reports]] · [[database]]

- Field reports take up to 3 photos of each casualty's injury and 3 of the structural damage, kept in the private `report-photos` Storage bucket and shown to admins only. Schema in `prisma/manual/DRRM-022-report-photos.sql`.
- The review of PR #89 fixed its findings and added caller checks to the remaining report actions.

## DRRM-021 Landing: turning campus, partners: 2026-10-29 (PR #88)

[[plan/feature/DRRM-021-landing-partners]] · [[pillars-and-landing]]

- The hero turns through the campuses, and the partners bar credits the UP Resilience Institute and the NOAH Center.

## DRRM-020 Type your own cluster: 2026-10-28 (PR #83)

[[plan/feature/DRRM-020-profile-custom-cluster]] · [[auth]]

- ERT members who can't find their cluster in profile setup type it under "Other (please specify)", like unit and position.

## DRRM-019 Export NSED report: 2026-10-28 (PR #81)

[[plan/feature/DRRM-019-nsed-report]] · [[events]]

- Completed UP Manila events export the office's quarterly NSED report as a Word file, filled from the reports in the office's template.

## DRRM-018 Design review fixes: 2026-10-28 (PR #80)

[[plan/feature/DRRM-018-design-review-fixes]] · [[design-system]]

- Fixes from the October 26 design review: a custom Select, placeholders, Unit optional where clusters have none, a readable error when Delete user fails, Campus, Users and Settings reachable on phones, and the Events row download opens the event report PDF (the Excel export and `exceljs` were removed).

## DRRM-017 Slim CLAUDE.md into the vault: 2026-10-26 (PR #76)

[[plan/feature/DRRM-017-slim-claude-md]]

- `CLAUDE.md` keeps the rules every task needs; the area detail moved into the `docs/` module notes.

## DRRM-015 MATATAG building assessment: 2026-10-20 → 2026-10-21 (merged through `dev` in PR #82, 2026-10-28)

Plans: [[plan/feature/DRRM-015-assessment-form]] · [[plan/feature/DRRM-015-phase-1-plan]] · [[plan/feature/DRRM-015-phase-2-plan]] · [[plan/feature/DRRM-015-assessment-print]]

- **Phase 1, ERT form** ([[assessments]], [[offline-pwa]]): MATATAG schema (`prisma/manual/DRRM-015-assessment.sql`) and seed, scoring by area and floors, token-checked actions ([[0007-token-verified-actions]]), offline drafts, cache and queue, the `/home` chooser and Report | Assessment switch, checklist language, the stepper with pre-screen and section index, review and submit, a one-question-at-a-time flashcard flow on phones, question search, and printing on A4 ([[print]]).
- **Phase 2, admins** ([[assessment-admin]], [[building-safety]], [[campus-scoping]]): admin scope check, `/assessments` list, details, print and delete, buildings on Settings, the building safety rollup on the dashboard (Campus → Cluster → Unit → Building) with history, compare and hand-built charts ([[0008-hand-built-charts]]).
- **Phase 3, checklist editor** ([[checklist-editor]]): a Super Admin edits wording in place and makes structural changes through a draft version ([[0006-versioned-checklist-template]]). Adds the Compare tab on `/assessments`.
- **Performance and polish:** batched draft-version cloning, query, index and caching work, 10-row pagination on the buildings, assessments and settings tables, a two-line building picker in Compare.

## DRRM-014 DRRM pillars: 2026-10-13 (PR #74)

[[plan/feature/DRRM-014-drrm-pillars]] · [[pillars-and-landing]]

- Placeholder pages for the four DRRM pillars, opened from the admin sidebar in a new tab.

## DRRM-013 UI polish: 2026-10-12 → 2026-10-13 (PR #73)

[[plan/feature/DRRM-013-ui-polish]] · [[design-system]]

- Light and dark mode (theme tokens, per-device choice), larger admin, ERT and bystander text, skeleton loading states, Spinner / Loader / Skeleton split, a redesigned PWA install card, the event report's casualties donut, landing hero fits the screen.
- maplibre-gl 6 upgrade for the DOM.sanitize XSS advisory.

## Knip cleanup: 2026-10-12

[[plan/review/2026-10-12-knip-unused-code]]

- Removed unused files, hooks, server actions, exports and packages.

## DRRM-007 → DRRM-012 redesign: 2026-10-09 → 2026-10-12

- **DRRM-007 Landing page v2** ([[plan/feature/DRRM-007-landing-page-v2]], [[pillars-and-landing]]): landing page rebuilt from the v2 design, unused `getLandingData` removed.
- **DRRM-008 Bystander report v2** ([[plan/feature/DRRM-008-bystander-report-v2]], [[bystander-reports]]): form rebuilt; stores contact number, damage photos and headcount (first manual SQL file, [[0002-manual-sql-schema-changes]]); admin details show campus, headcount, photos and contact.
- **DRRM-009 Auth pages v2** ([[plan/feature/DRRM-009-auth-pages-v2]], [[auth]]): sign-in, password reset and profile setup rebuilt; shared controls moved to `src/components/ds`.
- **DRRM-010 ERT report v2** ([[plan/feature/DRRM-010-ert-report-v2]], [[field-reports]]): `/report` status report rebuilt; shared people and privacy drawers.
- **DRRM-011 Super admin v2** ([[plan/feature/DRRM-011-super-admin-v2]]): new admin shell, shared table, drawer and dialog kit, dashboard and campus pages, events with complete-event and multi-campus add, the printable event report ([[print]]), reports, bystander reports and users rebuilt, settings on one tabbed page with field reordering ([[0009-table-driven-settings]]), record who completed an event.
- **DRRM-012 Admin v2** ([[plan/feature/DRRM-012-admin-v2]], [[campus-scoping]]): Administrators locked to their own campus.

## Docs and config: 2026-09-25 (PR #71)

- README rewritten with sequence diagrams, CLAUDE.md build and offline notes, simpler lint-staged config.

## Table redesign and September features: 2026-09-06 → 2026-09-15 (PRs #51–#64, #56)

- **Table redesign** ([[plan/feature/2026-09-09-table-redesign]], [[design-system]]): hybrid row actions, date-time cells, pagination.
- **Event summary with dynamic clusters** (PR #62, [[events]]): one summary per campus, clusters loaded from the DB.
- **PWA and offline** (PR #58, [[offline-pwa]]): install prompt, offline queues for field and bystander reports, `/~offline` page, `next build --webpack` ([[0003-webpack-build-for-pwa]], [[0004-offline-queue-bundled-create]]).
- **Population categories** (PR #54, [[field-reports]], [[settings-lookups]]): per-campus population fields and report population counts.
- **Auth session recovery** (PRs #49, #57, [[plan/fix/DRRM-001-auth-session-recovery]], [[auth]]): Google OAuth linking, stale profile cache, infinite spinner.
- **Report form required fields** (PR #59), settings enhancements (PR #53), sidebar and header polish (PR #55), UI component polish (PR #52), data privacy notice (PR #51).
- **Docs workflow** (PR #50, 2026-09-08): `docs/plan/` with templates and the dev branch audit ([[plan/review/2026-09-08-dev-branch-audit]]). Fix plans DRRM-002 → DRRM-006 written from it.
- maplibre-gl 5 → 6, dependency audit fixes.

## March → August 2026: first build (PRs #2–#48)

- 2026-03-18: initial commit.
- March → July: the first admin dashboard, events, field reports, bystander reports, users, campus and settings pages, built by several contributors in parallel branches (about 240 commits).
- 2026-08-07: first PWA version (manifest, next-pwa).
- 2026-08-10: `CLAUDE.md` added.
