---
type: reference
tags: [changelog]
---

# Changelog

What changed, newest first, grouped by ticket. Built from the git history up to `1474dfb` (2026-10-21). The only tag is `v0.0.1`, so entries are grouped by ticket, not by release. When a ticket merges, add an entry here and set its plan to `done`.

**Related:** [[00-index]] · [[conventions]]

## DRRM-015 MATATAG building assessment: 2026-10-20 → 2026-10-21 (branch `feat/DRRM-015-assessment-form`, not merged yet)

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
- **DRRM-009 Auth pages v2** ([[plan/feature/DRRM-009-auth-pages-v2]], [[auth-and-profiles]]): sign-in, password reset and profile setup rebuilt; shared controls moved to `src/components/ds`.
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
- **Auth session recovery** (PRs #49, #57, [[plan/fix/DRRM-001-auth-session-recovery]], [[auth-and-profiles]]): Google OAuth linking, stale profile cache, infinite spinner.
- **Report form required fields** (PR #59), settings enhancements (PR #53), sidebar and header polish (PR #55), UI component polish (PR #52), data privacy notice (PR #51).
- **Docs workflow** (PR #50, 2026-09-08): `docs/plan/` with templates and the dev branch audit ([[plan/review/2026-09-08-dev-branch-audit]]). Fix plans DRRM-002 → DRRM-006 written from it.
- maplibre-gl 5 → 6, dependency audit fixes.

## March → August 2026: first build (PRs #2–#48)

- 2026-03-18: initial commit.
- March → July: the first admin dashboard, events, field reports, bystander reports, users, campus and settings pages, built by several contributors in parallel branches (about 240 commits).
- 2026-08-07: first PWA version (manifest, next-pwa).
- 2026-08-10: `CLAUDE.md` added.
