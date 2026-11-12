---
type: index
updated: 2026-11-09
verified: true
tags: [index]
---

# DRRM-H IRS docs: start here

This vault is the `docs/` folder of the UPM DRRM-H Incident Reporting System repo. `CLAUDE.md` keeps only what every task needs. The area detail lives here. Read this note first, then read only the notes for the area you're about to touch. Code facts come from the source: when a note and the code disagree, the code wins and the note should be fixed.

## Orientation

- [[README]]: the docs workflow (document → plan → implement → update status), the folder purposes and the naming rules
- [[architecture]]: the project, data flow, the three clients, campus scoping, build and CI
- [[conventions]]: Prettier, lint-staged, forms, theme tokens, verification and docs rules (including frontmatter)
- [[glossary]]: DRRM-H, ERT, MATATAG, pillars, campus / cluster / unit, `client_ref` and other terms
- [[changelog]]: what shipped, newest first, by ticket

## Modules

| Area                           | Notes                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------- |
| People and access              | [[auth]] · [[users]] · [[campus-scoping]]                                                          |
| Incidents                      | [[events]] · [[field-reports]] · [[bystander-reports]] · [[dashboard]]                             |
| Building assessments (MATATAG) | [[assessments]] · [[assessment-admin]] · [[checklist-editor]] · [[building-safety]]                |
| Shared                         | [[routes]] · [[settings-lookups]] · [[offline-pwa]] · [[print]] · [[design-system]] · [[database]] |
| Public pages                   | [[pillars-and-landing]]                                                                            |

Each module note lists its paths, data, server actions, client pieces, rules and decisions. The plans that touch a module are in its **Backlinks** pane, because plans link to modules through their `modules:` frontmatter.

## Decisions

- [[0001-server-actions-only]]
- [[0002-manual-sql-schema-changes]]
- [[0003-webpack-build-for-pwa]]
- [[0004-offline-queue-bundled-create]]
- [[0005-assessment-single-route]]
- [[0006-versioned-checklist-template]]
- [[0007-token-verified-actions]]
- [[0008-hand-built-charts]]
- [[0009-table-driven-settings]]
- [[0010-off-campus-buildings]]

New decision: copy [[decisions/TEMPLATE]].

## Plans

Statuses are taken from each plan's frontmatter as of 2026-11-09. Keep this list in step when a status changes.

### Active

| Plan                                                                                                         | Status      | Branch                                          |
| ------------------------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------------- |
| [[plan/feature/DRRM-035-campus-logos-events-reports\|DRRM-035 Campus logos in Events and Reports]]           | done        | `feat/DRRM-035-campus-logos-events-reports`     |
| [[plan/feature/DRRM-034-page-header-menu-completed-note\|DRRM-034 Completed note minimizes]]                 | done        | `feat/DRRM-034-page-header-menu-completed-note` |
| [[plan/feature/DRRM-033-ui-polish-hover-checkbox\|DRRM-033 Visible hover, row click, Checkbox]]              | done        | `feat/DRRM-033-ui-polish-hover-checkbox`        |
| [[plan/feature/DRRM-034-admin-report-photos\|DRRM-034 Photos in the admin report drawer]]                    | in-review   | `feat/DRRM-034-admin-report-photos`             |
| [[plan/feature/DRRM-033-page-header-menu\|DRRM-033 PageHeader ⋯ menu]]                                       | in-review   | `feat/DRRM-033-page-header-menu`                |
| [[plan/feature/DRRM-032-nsed-report-pgh-diliman\|DRRM-032 NSED report for PGH and UP Diliman]]               | in-review   | `feat/DRRM-032-nsed-report-pgh-diliman`         |
| [[plan/feature/DRRM-031-headcount-by-unit-chart\|DRRM-031 Headcount by category chart on the event summary]] | in-review   | `feat/DRRM-031-headcount-by-unit-chart`         |
| [[plan/feature/DRRM-030-event-report-timeline\|DRRM-030 Timeline of reports on the event summary]]           | in-review   | `feat/DRRM-030-event-report-timeline`           |
| [[plan/feature/DRRM-028-nsed-report-v2\|DRRM-028 NSED report v2]]                                            | in-review   | `feat/DRRM-028-nsed-report-v2`                  |
| [[plan/review/2026-09-08-dev-branch-audit\|Dev branch audit (2026-09-08)]]                                   | in-progress | `dev`                                           |
| [[plan/fix/DRRM-002-emergency-reports-hardening\|DRRM-002 Emergency reports hardening]]                      | approved    | `fix/emergency-reports-hardening`               |
| [[plan/fix/DRRM-003-report-form-atomicity\|DRRM-003 Report form atomicity]]                                  | approved    | `fix/report-form-atomicity`                     |
| [[plan/fix/DRRM-004-events-dynamic-clusters\|DRRM-004 Events and dynamic clusters]]                          | approved    | `fix/events-dynamic-clusters`                   |
| [[plan/fix/DRRM-005-settings-hooks-performance\|DRRM-005 Settings, hooks and dashboard performance]]         | approved    | `fix/settings-hooks-performance`                |
| [[plan/fix/DRRM-006-schema-dual-write-sunset\|DRRM-006 Schema normalization and dual-write sunset]]          | approved    | `refactor/schema-dual-write-sunset`             |
| [[plan/feature/2026-09-09-table-redesign\|Data tables redesign]]                                             | approved    | `feature/table-redesign`                        |

DRRM-002 to DRRM-006 and the table redesign may be partly or fully done in code. Check before you rely on these statuses.

### Done

- [[plan/feature/DRRM-028-nsed-report-v2|DRRM-028 NSED report v2]] (PR #97)
- [[plan/feature/DRRM-027-pillar-page-redesign|DRRM-027 Pillar page redesign]] (PR #96)
- [[plan/feature/DRRM-026-off-campus-accounts|DRRM-026 Off-campus accounts]] (PR #95)
- [[plan/feature/DRRM-025-off-campus-assessment|DRRM-025 Off-campus building assessments]] (PR #94)
- [[plan/feature/DRRM-024-event-cluster-drilldown|DRRM-024 Event cluster and unit drill-down]] (PR #93)
- [[plan/fix/DRRM-023-report-500-and-role-routing|DRRM-023 Report 500s and role routing]] (PR #92)
- [[plan/review/2026-10-29-pr-89-report-photos|PR #89 report photos review (2026-10-29)]] (PR #90)
- [[plan/feature/DRRM-022-report-photos|DRRM-022 Photos on field reports]] (PRs #89, #90)
- [[plan/feature/DRRM-021-landing-partners|DRRM-021 Landing: turning campus, partners]] (PR #88)
- [[plan/feature/DRRM-020-profile-custom-cluster|DRRM-020 Type your own cluster]] (PR #83)
- [[plan/feature/DRRM-019-nsed-report|DRRM-019 Export NSED report]] (PR #81)
- [[plan/feature/DRRM-018-design-review-fixes|DRRM-018 Design review fixes]] (PR #80)
- [[plan/feature/DRRM-017-slim-claude-md|DRRM-017 Slim CLAUDE.md into the vault]] (PR #76)
- [[plan/feature/DRRM-015-assessment-form|DRRM-015 MATATAG building assessment]] (PR #82)
- [[plan/feature/DRRM-014-drrm-pillars|DRRM-014 DRRM pillars]] (PR #74)
- [[plan/feature/DRRM-013-ui-polish|DRRM-013 UI polish]] and DRRM-007 to DRRM-012 (PR #73): [[plan/feature/DRRM-007-landing-page-v2|007]] · [[plan/feature/DRRM-008-bystander-report-v2|008]] · [[plan/feature/DRRM-009-auth-pages-v2|009]] · [[plan/feature/DRRM-010-ert-report-v2|010]] · [[plan/feature/DRRM-011-super-admin-v2|011]] · [[plan/feature/DRRM-012-admin-v2|012]]
- [[plan/feature/DRRM-015-phase-1-plan|DRRM-015 Phase 1: ERT form]]
- [[plan/feature/DRRM-015-phase-2-plan|DRRM-015 Phase 2: admin results]]
- [[plan/feature/DRRM-015-assessment-print|DRRM-015 Printable assessment]]
- [[plan/fix/DRRM-001-auth-session-recovery|DRRM-001 Auth flow and session recovery]]
- [[plan/review/2026-10-12-knip-unused-code|Knip unused code review (2026-10-12)]]

### Templates

[[plan/feature/TEMPLATE|feature]] · [[plan/fix/TEMPLATE|fix]] · [[plan/bugs/TEMPLATE|bug]] · [[plan/review/TEMPLATE|review]] · [[decisions/TEMPLATE|decision]]

Bug reports: [[plan/bugs/DRRM-023-report-500-and-role-routing|DRRM-023 Report 500s and role routing]].
