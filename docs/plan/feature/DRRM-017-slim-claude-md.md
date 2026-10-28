---
type: feature
ticket: DRRM-017
status: in-review
branch: feat/DRRM-017-slim-claude-md
modules:
  - '[[auth]]'
  - '[[offline-pwa]]'
  - '[[routes]]'
  - '[[assessments]]'
  - '[[building-safety]]'
  - '[[settings-lookups]]'
  - '[[database]]'
tags: [plan, feature, docs]
---

# [DRRM-017] Feature Plan: Slim CLAUDE.md, move area knowledge into the vault

- **Status:** `[In Review]` (built and verified on 2026-10-22, waiting for the user's review)
- **Target Branch / PR:** `feat/DRRM-017-slim-claude-md`
- **Owner / Author:** DevJom

---

## 1. Problem Statement & Motivation

- `CLAUDE.md` is 116 lines and 2,160 words, and it is loaded on every task. About half of it explains one area: the auth flow, the offline queue, route groups, the MATATAG assessment and building safety. Those paragraphs cost context on every unrelated task, and one of them (line 68) is a single 700-word paragraph that is hard to keep up to date.
- `docs/` is now an Obsidian vault ([[00-index]]), with module notes that cover the same areas in more detail. The two copies will drift.
- The user is the developer and Claude Code. The goal: Claude reads the always-needed rules from `CLAUDE.md`, then reads only the note for the area it is about to touch.

---

## 2. Requirements & User Stories

- **As a developer using Claude Code**, I want `CLAUDE.md` to hold only what every task needs, so that area detail is read only when it matters and lives in one place.
- Key acceptance criteria:
  - [ ] `CLAUDE.md` is about 70–90 lines. It keeps: the project summary, commands, the three DISALLOWED commands word for word, the test-account rule, verification and CI, core rules (one line each), conventions, the docs workflow and the `nextjs-agent-rules` block, byte for byte.
  - [ ] Every fact in the current `CLAUDE.md` is either still there or in a note (Section 3.3). Every file path, function name and "why" is kept.
  - [ ] Each moved section leaves a pointer in `CLAUDE.md` that says when to read it (the "Area → note" table).
  - [ ] Notes have frontmatter `type`, `updated`, `verified: true`, link to each other with `[[wikilinks]]`, and name code in backticks.
  - [ ] Outdated `CLAUDE.md` statements are listed (Section 3.4) and are not silently fixed. Each one is fixed only after the user decides.
  - [ ] Nothing in `docs/README.md` or `docs/plan/` is moved, renamed or deleted.
  - [ ] An old vs. new comparison shows no lost facts. Line and word counts before and after are reported.

---

## 3. Architecture & Technical Design

### 3.1 Notes

| Note                                                      | State                                        | Gets from CLAUDE.md                                                                                             |
| --------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `docs/00-index.md`                                        | exists, update                               | the "start here" role, links to every note and `docs/README.md`                                                 |
| `docs/architecture.md`                                    | exists, update                               | data flow, hooks list, the 3 clients, campus scoping, project summary in full                                   |
| `docs/conventions.md`                                     | exists, update                               | theme token detail, Prettier and plugin detail, forms                                                           |
| `docs/modules/auth.md`                                    | **rename** of `modules/auth-and-profiles.md` | the whole auth flow paragraph                                                                                   |
| `docs/modules/offline-pwa.md`                             | exists, update                               | the whole Offline / PWA paragraph                                                                               |
| `docs/modules/routes.md`                                  | **new**                                      | the route groups list, admin shell and shared pieces, ERT guard                                                 |
| `docs/modules/assessments.md`                             | exists, update                               | the MATATAG paragraph: template, pure logic, single route, A4 print, access, token, language                    |
| `docs/modules/assessment-admin.md`, `checklist-editor.md` | exist, update                                | the admin pages and checklist editor sentences from the MATATAG paragraph                                       |
| `docs/modules/building-safety.md`                         | exists, update                               | dashboard Building safety section, `bs_*` params, pure functions, charts                                        |
| `docs/modules/settings-lookups.md`                        | exists, update                               | the generic Settings paragraph                                                                                  |
| `docs/modules/database.md`                                | **rename** of `modules/data-layer.md`        | Prisma schema and config rules, the schema-change process, the `db execute` command, the DISALLOWED list (copy) |

The renames are of notes made in the vault setup, which are not committed yet. They are not in `docs/plan/`. All `[[auth]]` and `[[database]]` links, including plan frontmatter, are updated in the same step.

Every note touched gets `updated: 2026-10-22` and `verified: true` in its frontmatter, after its claims are re-checked against the code.

### 3.2 Target `CLAUDE.md` shape (~85 lines)

1. Title and one-line intro
2. **Project** (2–3 lines)
3. **Project knowledge**: "Start with `docs/00-index.md`, read only the notes for your task", plus an **Area → note to read before touching it** table
4. **Commands** (block unchanged)
5. **NEVER run** (the DISALLOWED block word for word) + one line: schema changes → `docs/modules/database.md`
6. **Testing & verification**: verify commands, what `npm run test` covers, CI, Husky, test accounts
7. **Core rules** (one line each): server actions + `revalidatePath`; hooks invalidate keys (`use-events.ts`); three clients don't mix; pass the scoped campus id; new lookup → `LOOKUPS` / `LookupTable`; new-report data bundled in one `createReport` call; newer actions verify the token (`requireProfile` / `requireAdmin`), never trust client ids, return `{ ok: false, error, retry }`; don't hand-edit the generated Prisma client; don't lint-fix `src/components/ui/map.tsx`
8. **Conventions** (short)
9. **Docs & planning workflow** (short) + "After a task, update the related `docs/modules` note"
10. `nextjs-agent-rules` block (unchanged, byte for byte)

### 3.3 Fact map: every fact in the current CLAUDE.md → where it lives

Line numbers are from `CLAUDE.md` at the start of this ticket. **C** means it stays in `CLAUDE.md`, and a note name means it moves there. "C + note" means a one-line rule stays and the detail moves.

| #   | Line    | Fact                                                                                                                                                                                                                                               | Goes to                                                             |
| --- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | 3       | File gives guidance to Claude Code                                                                                                                                                                                                                 | C                                                                   |
| 2   | 7       | Next.js admin dashboard for the UPM DRRM-H IRS, on Supabase (PostgreSQL)                                                                                                                                                                           | C (short) + architecture                                            |
| 3   | 7       | Field teams and bystanders submit reports through the web app, including QR-accessible public forms                                                                                                                                                | C (short) + architecture                                            |
| 4   | 7       | Admins manage events/drills, view field reports and headcounts, manage users, configure lookup tables                                                                                                                                              | C (short) + architecture                                            |
| 5   | 7       | Repo `README.md` has the ER diagram, use-case diagrams, feature list                                                                                                                                                                               | C + architecture                                                    |
| 6   | 11–21   | Commands block (dev, build, lint, lint:fix, type-check, seed, seed:matatag, test, prisma generate, with comments)                                                                                                                                  | C (unchanged)                                                       |
| 7   | 13      | Build is `next build --webpack`, needed by next-pwa, don't switch to Turbopack                                                                                                                                                                     | C (in block) + offline-pwa ([[0003-webpack-build-for-pwa]])         |
| 8   | 18      | `seed:matatag` is idempotent, matches by code, never deletes, item ids stay stable                                                                                                                                                                 | C (in block) + database + assessments                               |
| 9   | 20      | `prisma generate` also runs on `postinstall`                                                                                                                                                                                                       | C (in block) + database                                             |
| 10  | 23      | Schema changes ship as idempotent SQL in `prisma/manual/<ticket>.sql` plus the matching `schema.prisma` edit                                                                                                                                       | C (one line) + database                                             |
| 11  | 23      | `prisma.config.ts` reads `.env`, so a worktree with only `.env.development.local` must pass the env in                                                                                                                                             | database                                                            |
| 12  | 23      | Apply over the direct connection; the pooler on :6543 hangs on `db execute`                                                                                                                                                                        | database                                                            |
| 13  | 25–28   | The exact `DATABASE_URL=… node --env-file=… db execute --file prisma/manual/<file>.sql` command                                                                                                                                                    | database (verbatim)                                                 |
| 14  | 30–35   | DISALLOWED: `npx prisma db push`, `npx prisma migrate dev`, `npx prisma migrate reset`                                                                                                                                                             | C (word for word) + database (copy)                                 |
| 15  | 37      | Test accounts (ERT Member, Administrator, Super Admin) in `test-accounts.local.md`, gitignored, may be missing in a worktree → ask; never copy into committed files                                                                                | C                                                                   |
| 16  | 39      | What `npm run test` covers; CI doesn't run it yet                                                                                                                                                                                                  | C (corrected wording, see 3.4 #5)                                   |
| 17  | 39      | Verify with lint, type-check, test, build                                                                                                                                                                                                          | C                                                                   |
| 18  | 41      | CI: `.github/workflows/ci.yml`, PRs/pushes to `main`: `npm ci` → `prisma generate` → `npm audit --audit-level=critical` → lint → type-check → build                                                                                                | C                                                                   |
| 19  | 41      | Husky pre-commit runs `lint-staged` (eslint --fix + prettier)                                                                                                                                                                                      | C + conventions                                                     |
| 20  | 45      | Every DB read/write is a `'use server'` function in `src/actions/<domain>/index.ts` using `src/lib/prisma.ts`                                                                                                                                      | C (one line) + architecture                                         |
| 21  | 45      | Components never call Prisma directly                                                                                                                                                                                                              | C (one line) + architecture                                         |
| 22  | 45      | Mutations call `revalidatePath(...)` for affected routes                                                                                                                                                                                           | C (one line) + architecture                                         |
| 23  | 47      | `src/components/hooks/use-<domain>.ts` wraps actions in TanStack Query (`useQuery`/`useMutation`), one file per domain                                                                                                                             | C (one line) + architecture                                         |
| 24  | 47      | The domain list: events, users, reports, settings, campus, dashboard, bystander-reports, population-categories, assessments, assessment-templates                                                                                                  | architecture                                                        |
| 25  | 47      | Mutations invalidate query keys on success; follow `use-events.ts`, not manual refetching                                                                                                                                                          | C (one line) + architecture                                         |
| 26  | 49      | Two Prisma/Postgres paths + one Supabase path; don't mix them                                                                                                                                                                                      | C (one line) + architecture                                         |
| 27  | 51      | `src/lib/prisma.ts`: server Prisma client via `@prisma/adapter-pg`, used from server actions                                                                                                                                                       | architecture + database                                             |
| 28  | 52      | `src/lib/supabase.ts`: browser Supabase SDK, auth only (`AuthProvider`, sign-in/out) and any Realtime                                                                                                                                              | architecture (see 3.4 #4)                                           |
| 29  | 53      | `src/lib/supabase-admin.ts`: server, service role key, for what Prisma can't do (Auth admin API)                                                                                                                                                   | architecture                                                        |
| 30  | 55      | Supabase Auth is the identity provider; Google OAuth restricted to `@up.edu.ph`                                                                                                                                                                    | auth                                                                |
| 31  | 55      | `users` table holds the app profile, linked by `auth_id`                                                                                                                                                                                           | auth                                                                |
| 32  | 55      | `AuthProvider` (`src/components/auth/auth-provider.tsx`) listens to `supabase.auth.onAuthStateChange`, loads the profile via `getUserByAuthId` into `useAuthStore` (Zustand)                                                                       | auth                                                                |
| 33  | 55      | New Google sign-ins are provisioned by `provisionGoogleUser` (`src/actions/auth`) as "ERT Member"                                                                                                                                                  | auth                                                                |
| 34  | 55      | `ProtectedRoute` gates admin pages by role                                                                                                                                                                                                         | auth + routes                                                       |
| 35  | 55      | `isAdminUserType()` (`src/lib/constants.ts`) decides admin; Administrator/Super Admin → `/dashboard`, others → `/home`                                                                                                                             | auth + routes                                                       |
| 36  | 55      | Non-admins start with `is_profile_complete = false`; `ProfileSetupGate` / `ProfileSetup` (`src/components/auth/profile-setup.tsx`) show full-page setup until campus/cluster/unit/position are set via `completeUserProfile` (`src/actions/users`) | auth                                                                |
| 37  | 55      | New field reports auto-fill cluster/unit from the profile                                                                                                                                                                                          | auth + field-reports (link)                                         |
| 38  | 55      | Auth pages and profile setup share `AuthShell` and the controls in `src/components/ds/`                                                                                                                                                            | auth                                                                |
| 39  | 57      | PWA via `@ducanh2912/next-pwa` in `next.config.ts`, disabled in dev, fallback `/~offline`                                                                                                                                                          | offline-pwa                                                         |
| 40  | 57      | New reports offline, or on a network-shaped failure (`isNetworkError`), go to IndexedDB via `src/lib/offline-queue.ts` (database v3)                                                                                                               | offline-pwa                                                         |
| 41  | 57      | Three queues: field reports (`ReportDrawer`, `ErtReportForm` → `createReport`), bystander (`createBystanderReport`), assessments (`createAssessment`)                                                                                              | offline-pwa                                                         |
| 42  | 57      | Two plain stores: `assessment-drafts` (by `client_ref`), `assessment-cache` (checklist + setup, so the form opens offline)                                                                                                                         | offline-pwa + assessments                                           |
| 43  | 57      | Pending count is `getAllQueuedCount()`                                                                                                                                                                                                             | offline-pwa (see 3.4 #3)                                            |
| 44  | 57      | `OfflineQueueProvider` (`src/components/pwa/`, mounted in `src/components/providers.tsx`) replays on `online`, on mount, every 45 s                                                                                                                | offline-pwa                                                         |
| 45  | 57      | Network errors stop the flush and keep entries; server rejections mark `failed`, never auto-retried                                                                                                                                                | offline-pwa                                                         |
| 46  | 57      | Connectivity and pending count live in `useOfflineQueueStore`                                                                                                                                                                                      | offline-pwa                                                         |
| 47  | 57      | Editing an existing report is online-only                                                                                                                                                                                                          | offline-pwa                                                         |
| 48  | 57      | `createReport` takes casualties/missing persons/population counts nested in one call because the queue replays one payload; keep it bundled                                                                                                        | C (one line) + offline-pwa ([[0004-offline-queue-bundled-create]])  |
| 49  | 61      | `(admin)/`: protected pages (dashboard, events, reports, emergency-reports, users, settings, campus) in one shell                                                                                                                                  | routes (see 3.4 #6)                                                 |
| 50  | 61      | Shell `_components/shell`: sidebar on web, icon rail on tablet, bottom tabs on phone                                                                                                                                                               | routes                                                              |
| 51  | 61      | Campus switcher (`useCampusScopeStore`, via `useScopedCampusId`) scopes every list and the dashboard; pass its id, no per-page filters                                                                                                             | C (one line) + architecture + routes                                |
| 52  | 61      | `(admin)/_components`: list table that turns into cards on phone, drawer parts, confirm dialog                                                                                                                                                     | routes                                                              |
| 53  | 61      | `(admin)/_lib`: status colours, formatting, the event summary model (campus details, event details, report PDF)                                                                                                                                    | routes                                                              |
| 54  | 62      | `(print)/`: `/events/report`, A4, saved as PDF from the print dialog, signed-in admins, no shell                                                                                                                                                   | routes (see 3.4 #6)                                                 |
| 55  | 63      | `(auth)/`: sign-in                                                                                                                                                                                                                                 | routes (see 3.4 #6)                                                 |
| 56  | 64      | `(ert)/`: signed-in ERT pages sharing `(ert)/_components` (`ErtFrame`, `TopBar` with Report / Assessment switch, `chrome.tsx`)                                                                                                                     | routes                                                              |
| 57  | 64      | `(ert)/_lib` `useErtAccess`: signed out → `/signin`, admins → `/dashboard`, incomplete profile → `ProfileSetup`                                                                                                                                    | routes + auth                                                       |
| 58  | 64      | `/home` is the landing chooser; `/report` the status report; `/assessment` the building assessment                                                                                                                                                 | routes                                                              |
| 59  | 64      | One report per user per ongoing event (`getMyReportForOngoingEvent`), then only missing persons/casualties can be edited                                                                                                                           | routes + field-reports (link)                                       |
| 60  | 65      | `(public)/`: landing page and anonymous QR bystander form, no auth                                                                                                                                                                                 | routes                                                              |
| 61  | 66      | `auth/`: OAuth callback route                                                                                                                                                                                                                      | routes                                                              |
| 62  | 68      | Template tables `assessment_templates` → `_template_versions` (one `published`) → `_sections` → `_items`                                                                                                                                           | assessments ([[0006-versioned-checklist-template]])                 |
| 63  | 68      | An assessment keeps the version it was answered with                                                                                                                                                                                               | assessments                                                         |
| 64  | 68      | Group parents are unscored and hold the shared prompt; every scored item has one DRRM pillar                                                                                                                                                       | assessments                                                         |
| 65  | 68      | Buildings belong to a unit and keep a profile (floors, `building_areas`) that pre-fills the next assessment                                                                                                                                        | assessments                                                         |
| 66  | 68      | Checklist text seeded from `prisma/data/matatag-2025-07-25.ts` by `npm run seed:matatag`                                                                                                                                                           | assessments + database                                              |
| 67  | 68      | Shared pure logic in `src/lib`: `assessment-template.ts` (types, `templateFromData`), `assessment-score.ts` (applicability, scoring, `prepareAssessmentWrite`), `assessment-draft.ts` (draft and payload)                                          | assessments                                                         |
| 68  | 68      | One route `/assessment`, `?draft=`, `?view=`, `?print=` (A4 without `ErtFrame`, keeps the ERT guard), because a dynamic segment may not be cached offline                                                                                          | assessments + routes ([[0005-assessment-single-route]])             |
| 69  | 68      | A4 frame (sheets, letterhead, `@page`) is `src/components/print/report-sheet.tsx`, shared with the `(print)` event report                                                                                                                          | assessments + print (link)                                          |
| 70  | 68      | On paper `<Bilingual language="both">` ignores the device setting                                                                                                                                                                                  | assessments                                                         |
| 71  | 68      | Access only through `canUseAssessment()` (`src/lib/access.ts`): `/home` card, switch, page guard, server action                                                                                                                                    | assessments                                                         |
| 72  | 68      | `src/actions/assessments` takes the token (`getAccessToken()`), verifies with `requireProfile(token)` (`src/lib/server-auth.ts`), uses that profile as evaluator                                                                                   | C (one line) + assessments + auth ([[0007-token-verified-actions]]) |
| 73  | 68      | Expected failures return `{ ok: false, error, retry }`, not thrown (thrown messages hidden in production); `retry: true` keeps an offline entry pending                                                                                            | C (one line) + assessments                                          |
| 74  | 68      | Question text follows the per-device "Checklist language" (`useQuestionLanguageStore`, `<Bilingual>`)                                                                                                                                              | assessments                                                         |
| 75  | 68      | `src/actions/assessment-admin`: lists, detail, Super-Admin-only delete; each calls `requireAdmin(token, campusId)` + `adminScope` (`src/lib/admin-scope.ts`): Administrator gets own campus, Super Admin the one asked or all                      | assessments (summary) + assessment-admin + architecture (scoping)   |
| 76  | 68      | Shared server-only loaders in `src/lib/assessment-records.ts` (template version, `AssessmentRecord`, buildings with latest two scores)                                                                                                             | assessments + assessment-admin                                      |
| 77  | 68      | Score arithmetic (pillar rows, change in points) in `src/lib/building-safety.ts`                                                                                                                                                                   | building-safety                                                     |
| 78  | 68      | Admin pages `/assessments` (Buildings / Assessments / Compare), `/assessments/details?id=` (`AssessmentRecordBody`), `/assessments/report?id=` (`RecordPrint`)                                                                                     | assessment-admin + routes                                           |
| 79  | 68      | Checklist editor `/assessments/checklist` (`src/actions/assessment-templates`, `use-assessment-templates.ts`); wording in place vs. draft → publish → retire rule; area types on the same page                                                     | checklist-editor + assessments (summary)                            |
| 80  | 68      | Buildings are fixed on Settings → Buildings (the shared lookup table)                                                                                                                                                                              | settings-lookups + assessment-admin                                 |
| 81  | 68      | Dashboard Building safety (`(admin)/dashboard/_components/building-safety/`, `src/actions/building-safety`) drills Campus → Cluster → Unit → Building                                                                                              | building-safety                                                     |
| 82  | 68      | Level in `bs_campus` / `bs_cluster` / `bs_unit` / `bs_building` / `bs_a` / `bs_b`; drilling pushes history, A/B picks replace; never moves the campus switcher                                                                                     | building-safety                                                     |
| 83  | 68      | Pooling, like-for-like change, section scores, most-failed items, A/B comparison, `scopeFromParams`: pure, tested, in `src/lib/building-safety.ts`                                                                                                 | building-safety                                                     |
| 84  | 68      | Charts hand-built in `(admin)/_components/charts/` with `--series-1…6` from `globals.css`, dataviz validator, values always printed                                                                                                                | building-safety + conventions ([[0008-hand-built-charts]])          |
| 85  | 70      | Lookup tables share one implementation: `LOOKUPS` + `LookupTable` in `src/app/(admin)/settings/_components/` + `src/actions/settings`, tabs on one page                                                                                            | C (one line) + settings-lookups (see 3.4 #2)                        |
| 86  | 70      | New lookup table: extend the pattern, no bespoke CRUD page                                                                                                                                                                                         | C (one line) + settings-lookups                                     |
| 87  | 72      | `users`, `reports`, `bystander_reports`, `clusters` scoped by `campus_id` / `cluster_id`                                                                                                                                                           | architecture                                                        |
| 88  | 72      | Copy the filtering pattern of existing actions, e.g. `getOngoingEvents(campusId)` in `src/actions/events`                                                                                                                                          | architecture                                                        |
| 89  | 74      | `schema.prisma`: snake_case tables/columns (`@map`/`@@map`), PascalCase models (`User` → `users`)                                                                                                                                                  | database                                                            |
| 90  | 74      | IDs are `dbgenerated("gen_random_uuid()")` UUIDs                                                                                                                                                                                                   | database                                                            |
| 91  | 74      | Generated client is emitted to `src/generated/`, never hand-edit                                                                                                                                                                                   | C (one line) + database (see 3.4 #1)                                |
| 92  | 76      | Prisma config in `prisma.config.ts` (not `package.json`), with `DATABASE_URL` and `SHADOW_DATABASE_URL`                                                                                                                                            | database                                                            |
| 93  | 80      | Path alias `@/*` → `src/*`                                                                                                                                                                                                                         | C                                                                   |
| 94  | 81      | Prettier: single quotes, semicolons, 100 width                                                                                                                                                                                                     | C (short) + conventions                                             |
| 95  | 81      | Tailwind class sorting and import organizing via `prettier-plugin-tailwindcss` / `prettier-plugin-organize-imports`; don't hand-order                                                                                                              | C (short) + conventions                                             |
| 96  | 82      | `src/components/ui/map.tsx` vendored from mapcn, excluded from lint; don't fix it                                                                                                                                                                  | C (one line) + conventions                                          |
| 97  | 83      | Zod form schemas in `src/lib/schemas.ts`; forms use `react-hook-form` + `@hookform/resolvers`                                                                                                                                                      | C (short) + conventions                                             |
| 98  | 84      | Theme tokens in `globals.css` change under `.dark` on `<html>`; no `dark:` variants needed                                                                                                                                                         | C (short) + conventions                                             |
| 99  | 84      | `bg-canvas` pages, `bg-surface` (not `bg-white`) cards/bars/drawers/inputs, `border-line` hairlines, `bg-brand-solid` maroon with white text                                                                                                       | C (short) + conventions                                             |
| 100 | 84      | Hex values in class names stay the same in both themes (maroon heroes)                                                                                                                                                                             | conventions                                                         |
| 101 | 84      | Light / Dark / Device choice saved per device by `useThemeStore`, set in My profile                                                                                                                                                                | conventions                                                         |
| 102 | 84      | `data-theme="light"` keeps a subtree light (the A4 report)                                                                                                                                                                                         | C (short) + conventions                                             |
| 103 | 88      | Non-trivial tasks, reviews, bugs, feature specs are documented under `docs/`                                                                                                                                                                       | C                                                                   |
| 104 | 90–98   | `docs/` tree with the four plan folders and their purpose                                                                                                                                                                                          | C (one line) + `docs/README.md` (already there)                     |
| 105 | 102     | Kebab-case with ticket/date prefixes, with examples                                                                                                                                                                                                | C + conventions                                                     |
| 106 | 103     | Standard header `- **Status:** [Draft \| In Review \| Approved \| In Progress \| Done]`                                                                                                                                                            | C + conventions                                                     |
| 107 | 104     | Branches map 1:1 to plan files                                                                                                                                                                                                                     | C + conventions (see 3.4 #8)                                        |
| 108 | 105     | Templates at `docs/plan/{review,bugs,fix,feature}/TEMPLATE.md`                                                                                                                                                                                     | C                                                                   |
| 109 | 106     | `docs/` is an Obsidian vault; read `docs/00-index.md` first; plan frontmatter fields                                                                                                                                                               | C ("Project knowledge") + conventions                               |
| 110 | 108–116 | `nextjs-agent-rules` block                                                                                                                                                                                                                         | C (byte for byte)                                                   |
| 111 | new     | After a task, update the related `docs/modules` note                                                                                                                                                                                               | C (new rule from this ticket)                                       |

### 3.4 Outdated statements in the current CLAUDE.md (not fixed yet: the user decides)

Checked against the code on 2026-10-22.

1. **Line 74, `src/generated/`:** there is no such folder. `schema.prisma`'s generator sets no `output`, so the client goes to `node_modules` and code imports `@prisma/client`.
2. **Line 70, lookup list:** the `LOOKUPS` tabs (`settings-page.tsx`) are clusters, units, buildings, positions, casualty conditions and damage conditions, plus a separate Population fields tab. There is no locations table. User types and event statuses are seeded and have no tab.
3. **Line 57, "the pending count everywhere is `getAllQueuedCount()`":** true for the provider, the ERT report form and the assessment hub. Not true for two places:
   - The admin `ReportDrawer` sets it to bystander + field counts (`report-drawer.tsx:244`).
   - The bystander form sets it to `getQueuedReportCount()` only (`bystander-report-form.tsx:264`).
4. **Line 52, "anon key" and Realtime:** the browser client uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` (Supabase's publishable key). No Realtime subscriptions exist in `src/` today.
5. **Line 39, test coverage:** `npm run test` also covers `access`, `admin-scope`, `offline-cache`, `offline-flush` and `schemas`. That is more than "assessment logic". The checklist data test is `prisma/data/matatag-2025-07-25.test.ts`.
6. **Lines 61–66, route groups:**
   - `(admin)/` also has `assessments`.
   - `(print)/` also has `assessments/report`.
   - `(auth)/` also has `forgot-password` and `update-password`.
   - The `(pillars)/` and `~offline` groups are missing.
7. **Line 55, sign-in methods:** sign-in also supports email + password (`signInWithPassword` in `sign-in-form.tsx`), not only Google. This is incomplete rather than wrong. The `@up.edu.ph` rule is enforced in `provisionGoogleUser`.
8. **Line 104, branch example:** `bugfix/DRRM-003-...` doesn't match the real branch `fix/report-form-atomicity`. Feature branches use `feat/`.
9. **Line 103, status values:** the templates use different sets. Feature uses `Completed` where the others use `Done`, and bugs use `Open | In Progress | Resolved`.

---

### 3.5 What was done with each outdated item

The user approved the plan on 2026-10-22 ("OK"). The new text describes the code as it is. Wherever an old statement was wrong, the note names the old wording, so the change is visible rather than silent.

| #   | Resolution                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `CLAUDE.md` says "never hand-edit the generated Prisma client (`npx prisma generate`, imported from `@prisma/client`)". `database.md` and `conventions.md` record that `src/generated/` doesn't exist.                |
| 2   | `settings-lookups.md` lists the real tabs, says there's no locations table, and notes that user types and event statuses have no tab. Decision 0009 already matched.                                                  |
| 3   | `offline-pwa.md` names the two callers that don't use `getAllQueuedCount()`. The code was not changed. If that should be fixed, it's a separate fix ticket.                                                           |
| 4   | `architecture.md` names the publishable key and says no Realtime subscriptions exist.                                                                                                                                 |
| 5   | `CLAUDE.md` and `architecture.md` list the full test coverage.                                                                                                                                                        |
| 6   | `routes.md` lists every group and page, including `(pillars)/`, `~offline`, `(admin)/assessments`, `(print)/assessments/report`, and `forgot-password` / `update-password`.                                           |
| 7   | `auth.md` mentions email + password sign-in.                                                                                                                                                                          |
| 8   | The `CLAUDE.md` branch example is now `feat/DRRM-015-...` ↔ `docs/plan/feature/DRRM-015-...`, and the file-name example is a real file (`DRRM-003-report-form-atomicity.md`). `conventions.md` notes the old example. |
| 9   | `conventions.md` records that the templates' status values differ. The templates were not changed.                                                                                                                    |

---

## 4. Implementation Tasks

- [x] Task 0: Branch `feat/DRRM-017-slim-claude-md` (base: see Section 6). Commit the vault setup first as its own commit.
- [x] Task 1: Rename `modules/auth-and-profiles.md` → `modules/auth.md`, `modules/data-layer.md` → `modules/database.md`. Update every wikilink and plan `modules:` entry.
- [x] Task 2: Re-verify, then write the facts from Section 3.3 into each note. Add `updated` and `verified: true`.
- [x] Task 3: Write `modules/routes.md`.
- [x] Task 4: Update `00-index.md` (routes, renamed notes, this plan).
- [x] Task 5: Rewrite `CLAUDE.md` to the Section 3.2 shape. Copy the DISALLOWED block and the `nextjs-agent-rules` block byte for byte.
- [x] Task 6: Apply the user's decisions on Section 3.4.

---

## 5. Verification & Rollout Plan

- [x] Script: every row in Section 3.3 is found in `CLAUDE.md` or its target note. Check by key token: each backticked path, function or command from the old file appears in the new file or the vault.
- [x] `diff` of the DISALLOWED block and the `<!-- BEGIN:nextjs-agent-rules -->` … `END` block, old vs. new: no change.
- [x] Vault link check: 0 broken wikilinks. Prettier check on `docs/` and `CLAUDE.md`.
- [x] Report the line and word count before (116 lines, 2,160 words) and after.

**Results (2026-10-22):**

- `CLAUDE.md`: 116 → 92 lines, 2,160 → 1,007 words (−53 % words).
- The Commands, DISALLOWED and `nextjs-agent-rules` blocks are byte-identical between old and new (`factcheck.mjs`).
- The old file had 222 distinct code tokens. 75 are in the new `CLAUDE.md` and 144 only in the vault. The other 3 are examples replaced on purpose (3.5 #8, and the frontmatter quote style).
- 39 prose facts with no code token were matched by regex in `CLAUDE.md` or a note. None are lost.
- Vault: 60 notes, 601 links, 0 broken. Prettier is clean on `docs/` and `CLAUDE.md`.

---

## 6. Open decisions

- **Branch base:** recommended is stacking on `feat/DRRM-015-assessment-form`. The assessment facts and the uncommitted vault setup only exist there. The alternative is branching from `dev` without the assessment content.
- **Renames:** recommended is `auth-and-profiles` → `auth` and `data-layer` → `database`, as requested. The alternative is keeping the current names, mapping them in the index and skipping the renames.
- **Section 3.4:** fix each item in `CLAUDE.md` and the notes, or only record it.
