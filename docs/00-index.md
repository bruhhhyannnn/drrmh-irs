---
type: index
updated: 2026-10-29
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

New decision: copy [[decisions/TEMPLATE]].

## Plans

Statuses are taken from each plan's frontmatter as of 2026-10-22. Keep this list in step when a status changes.

### Active

| Plan                                                                                                 | Status      | Branch                                 |
| ---------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------- |
| [[plan/feature/DRRM-022-report-photos\|DRRM-022 Photos on field reports]]                            | in-review   | `feat/DRRM-022-report-photos`          |
| [[plan/feature/DRRM-021-landing-partners\|DRRM-021 Landing: turning campus, partners]]               | in-review   | `feat/DRRM-021-landing-partners`       |
| [[plan/feature/DRRM-020-profile-custom-cluster\|DRRM-020 Type your own cluster]]                     | in-review   | `feat/DRRM-020-profile-custom-cluster` |
| [[plan/feature/DRRM-019-nsed-report\|DRRM-019 Export NSED report]]                                   | in-review   | `feat/DRRM-019-nsed-report`            |
| [[plan/feature/DRRM-018-design-review-fixes\|DRRM-018 Design review fixes]]                          | in-review   | `feat/DRRM-018-design-review-fixes`    |
| [[plan/feature/DRRM-017-slim-claude-md\|DRRM-017 Slim CLAUDE.md into the vault]]                     | in-review   | `feat/DRRM-017-slim-claude-md`         |
| [[plan/feature/DRRM-015-assessment-form\|DRRM-015 MATATAG building assessment]]                      | in-progress | `feat/DRRM-015-assessment-form`        |
| [[plan/review/2026-09-08-dev-branch-audit\|Dev branch audit (2026-09-08)]]                           | in-progress | `dev`                                  |
| [[plan/feature/DRRM-007-landing-page-v2\|DRRM-007 Landing page v2]]                                  | in-review   | `feat/DRRM-007-landing-page-v2`        |
| [[plan/feature/DRRM-008-bystander-report-v2\|DRRM-008 Bystander report v2]]                          | in-review   | `feat/DRRM-008-bystander-report-v2`    |
| [[plan/feature/DRRM-009-auth-pages-v2\|DRRM-009 Auth pages v2]]                                      | in-review   | `feat/DRRM-009-auth-pages-v2`          |
| [[plan/feature/DRRM-010-ert-report-v2\|DRRM-010 ERT report v2]]                                      | in-review   | `feat/DRRM-010-ert-report-v2`          |
| [[plan/feature/DRRM-011-super-admin-v2\|DRRM-011 Super admin v2]]                                    | in-review   | `feat/DRRM-011-super-admin-v2`         |
| [[plan/feature/DRRM-012-admin-v2\|DRRM-012 Admin v2]]                                                | in-review   | `feat/DRRM-012-admin-v2`               |
| [[plan/feature/DRRM-013-ui-polish\|DRRM-013 UI polish]]                                              | in-review   | `feat/DRRM-013-ui-polish`              |
| [[plan/feature/DRRM-014-drrm-pillars\|DRRM-014 DRRM pillars]]                                        | in-review   | `feat/DRRM-014-drrm-pillars`           |
| [[plan/fix/DRRM-002-emergency-reports-hardening\|DRRM-002 Emergency reports hardening]]              | approved    | `fix/emergency-reports-hardening`      |
| [[plan/fix/DRRM-003-report-form-atomicity\|DRRM-003 Report form atomicity]]                          | approved    | `fix/report-form-atomicity`            |
| [[plan/fix/DRRM-004-events-dynamic-clusters\|DRRM-004 Events and dynamic clusters]]                  | approved    | `fix/events-dynamic-clusters`          |
| [[plan/fix/DRRM-005-settings-hooks-performance\|DRRM-005 Settings, hooks and dashboard performance]] | approved    | `fix/settings-hooks-performance`       |
| [[plan/fix/DRRM-006-schema-dual-write-sunset\|DRRM-006 Schema normalization and dual-write sunset]]  | approved    | `refactor/schema-dual-write-sunset`    |
| [[plan/feature/2026-09-09-table-redesign\|Data tables redesign]]                                     | approved    | `feature/table-redesign`               |

DRRM-007 to DRRM-014 were merged to `dev` (PRs #73, #74) but their plans still say "In Review". DRRM-002 to DRRM-006 and the table redesign may be partly or fully done in code. Check before you rely on these statuses.

### Done

- [[plan/feature/DRRM-015-phase-1-plan|DRRM-015 Phase 1: ERT form]]
- [[plan/feature/DRRM-015-phase-2-plan|DRRM-015 Phase 2: admin results]]
- [[plan/feature/DRRM-015-assessment-print|DRRM-015 Printable assessment]]
- [[plan/fix/DRRM-001-auth-session-recovery|DRRM-001 Auth flow and session recovery]]
- [[plan/review/2026-10-12-knip-unused-code|Knip unused code review (2026-10-12)]]

### Templates

[[plan/feature/TEMPLATE|feature]] · [[plan/fix/TEMPLATE|fix]] · [[plan/bugs/TEMPLATE|bug]] · [[plan/review/TEMPLATE|review]] · [[decisions/TEMPLATE|decision]]

No bug reports have been written yet (`plan/bugs/` holds only its template).
