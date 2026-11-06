---
type: feature
ticket: DRRM-026
status: draft
branch: feat/DRRM-026-off-campus-accounts
modules:
  - '[[auth]]'
  - '[[users]]'
  - '[[assessments]]'
  - '[[assessment-admin]]'
  - '[[building-safety]]'
  - '[[campus-scoping]]'
  - '[[database]]'
tags: [plan, feature]
---

# [DRRM-026] Off-campus accounts: Design

- **Status:** `Draft`
- **Target Branch / PR:** `feat/DRRM-026-off-campus-accounts`, stacked on `feat/DRRM-025-off-campus-assessment` (PR #94)
- **Owner / Author:** Jomar Lazaro

This is the design. The implementation plan follows once it's approved.

---

## 1. Problem Statement & Motivation

The app is being pilot-tested outside UP. People at the pilot sites aren't UP staff: they have no `@up.edu.ph` Google account, belong to no UP campus or cluster, and can't get through today's profile setup without pretending to.

DRRM-025 lets UP accounts assess buildings outside campus. This ticket lets the pilot-site people have their own accounts.

---

## 2. What the user decided

1. **A Super Admin creates the account.** On the Users page they enter an email and password (for example a Gmail address) and turn on **Off-campus account**. Nobody signs themselves up.
2. **Only ERT Member accounts can be off campus.** Administrators and Super Admins are unchanged.
3. **Off-campus setup on first sign-in.** The person signs in with that email and password, then fills in an off-campus profile instead of campus, cluster, unit and position:
   - full name
   - address
   - organization
   - organization address
   - position
4. **No Report tool.** On `/home` and in the Report | Assessment switch, Report shows greyed out and unclickable, with **"Not available for off-campus accounts"**.
5. **Assessment only, off campus only.** The Assessment tool works, always as Off campus.
6. **Only Super Admins see their results** for now. Campus Administrators never do.

## 3. Goals, non-goals, anti-goals

**Goals:** the six decisions above, working offline as the rest of the ERT pages do.

**Non-goals (this ticket):**

- Self sign-up, or Google sign-in for non-UP accounts. Google stays `@up.edu.ph` only.
- The Report tool for off-campus accounts.
- Organizations as a managed list, or admins per organization.
- Letting a campus Administrator see pilot results.
- Turning an existing account into an off-campus one, or back.

**Anti-goals (a failure even if it works):**

- An off-campus account's assessment changes any campus or All-campus score, or appears in a campus Administrator's lists.
- Someone gets in who wasn't given an account.
- An off-campus person has to pick a UP campus, cluster or unit anywhere.

---

## 4. Design

### Data

`users` gets, through `prisma/manual/DRRM-026-off-campus-accounts.sql`:

| Column                                                              | Notes                     |
| ------------------------------------------------------------------- | ------------------------- |
| `is_off_campus`                                                     | boolean, default false    |
| `address`, `organization`, `organization_address`, `position_title` | text, null on UP accounts |

- **Check:** an off-campus account has no `campus_id`, `cluster_id`, `unit_id` or `position_id`.
- **Names:** full name uses the existing `first_name`, `middle_name`, `last_name` and `suffix`.
- **Position:** `position_title` is free text, because UP's position list won't fit other organizations.

`buildings`: an off-campus building may have **no** `campus_id` when an off-campus account adds it. A building with no campus is visible to Super Admins only.

- Relax `chk_buildings_place` from DRRM-025 to allow this.
- Make `uq_buildings_campus_barangay_name` treat a missing campus as one group (Postgres 15 `NULLS NOT DISTINCT`), so the same building isn't added twice.

### Who sees what

|                                                                    | Off-campus account    | Administrator | Super Admin             |
| ------------------------------------------------------------------ | --------------------- | ------------- | ----------------------- |
| Their own assessments (hub, view, print)                           | Yes                   | —             | —                       |
| Buildings with no campus, on the Details step                      | Yes (shared, see 6.1) | —             | —                       |
| Those assessments and buildings in admin pages, dashboard, pillars | —                     | No            | Yes, under All campuses |
| The account on the Users page                                      | —                     | No            | Yes, marked Off-campus  |

- **`adminScope` and `inScope`:** a record with no campus is in scope only when the scope is all campuses (`campusId: null`). A Super Admin who picks one campus in the switcher doesn't see it.
- **Building filters:** `buildingInCampus(campusId)` already leaves out buildings with no campus when a campus is given, so no change is needed there.
- **Users list:** `getUsers` with a campus leaves out off-campus accounts. Only All campuses shows them.

### Sign-in and setup

- **Account creation:** `createUser` accepts `is_off_campus` with no campus, but only when the creator is a Super Admin. It verifies the caller with `requireAdmin`: today it trusts the client, and this ticket fixes that for this path. The user drawer gets an **Off-campus account** switch for ERT Members, which hides the campus, cluster, unit and position fields.
- **Sign-in:** email and password, already supported. Password reset by email already works for any address.
- **Setup:** `ProfileSetup` shows an off-campus form when `is_off_campus` is set. The new `completeOffCampusProfile(token, data)` verifies the caller with `requireProfile` and saves the fields with `is_profile_complete = true`. The form shows the existing data privacy notice (`DataPrivacyContent`) with a consent checkbox, because it collects addresses.
- **My profile drawer:** shows organization and position in place of campus and cluster.

### Report and Assessment

- **Report access:** `canUseReport(profile)` in `src/lib/access.ts` (false for off-campus) drives the `/home` card, the top-bar switch and the `/report` page, which shows the message instead of the form. The report server actions refuse an off-campus caller.
- **Assessment caller:** `canUseAssessment` stays true. `checkAssessmentCaller` accepts an off-campus account with no campus.
- **Assessment setup:** `getAssessmentSetup` returns no clusters and no events for it, and the shared buildings with no campus. Today `useAssessmentSetup` is keyed by campus id and turned off without one, and the hub waits for it, so it must work for an account with no campus (an `off-campus` cache key).
- **Details step:** the On campus / Off campus choice is hidden and set to Off campus, and "Results go to …" reads "Results go to DRRM-H Super Admins".
- **Submit:** `createAssessment` creates the building with no campus and refuses a building that has one.

---

## 5. Constraints

- The CLAUDE.md core rules apply: server actions only, token-verified actions for new code, the bundled create for the offline queue, theme tokens, and manual SQL only (never `db push` or `migrate`).
- The SQL runs on dev and production before the code deploys, as with DRRM-025.
- Drafts and queued assessments made before this change keep working.

## 6. Left to the builder, or decided by me (check these)

1. **My call:** buildings added by off-campus accounts form one shared list across all pilot sites. Any off-campus account can pick a building another one added in the same barangay. It avoids duplicates, but people at one site can see building names from another.
2. **My call:** address and organization address are free text, not the PSGC dropdowns.
3. **My call:** passwords need at least 8 characters, which matches the Users form today. There's no forced change on first sign-in, so the Super Admin should share passwords privately.
4. **My call:** the Super Admin can edit the off-campus fields later in the user drawer.
5. **Builder:** column names, the exact message wording, and where `canUseReport` is checked on the server.

---

## 7. Implementation Tasks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Super-Admin-made off-campus ERT accounts that set up their own profile, can't use Report, assess off campus only, and are seen by Super Admins only.

**Architecture:** A flag on `users`, a building that may have no campus, and the existing access helpers (`access.ts`, `assessment-caller.ts`, `report-caller.ts`, `admin-scope.ts`, `building-place.ts`) learning about both, so pages and actions follow.

**Tech Stack:** Next.js server actions, Prisma with manual SQL, Supabase Auth admin API, TanStack Query, `node:test` via `tsx`.

**Spec:** sections 1 to 6 of this file.

### Global Constraints

- Never `prisma db push` / `migrate dev` / `migrate reset`. Schema in `prisma/manual/DRRM-026-off-campus-accounts.sql` plus `schema.prisma`.
- New and changed actions verify the token (`requireProfile` / `requireAdmin`) and return expected failures as `{ ok: false, error }`.
- Report message, exactly: `Not available for off-campus accounts`. Results line, exactly: `Results go to DRRM-H Super Admins.`
- Theme tokens only. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Review Focus

1. A UP ERT member's draft, queue and assessments behave exactly as on DRRM-025 (campus required, campus-owned off-campus buildings): Task 4 caller tests.
2. A campus Administrator never sees a no-campus building or assessment, including by URL: Task 1 `inScope` tests.
3. A non-Super-Admin can't create an off-campus account by calling the action directly: Task 2, checked in the action.
4. An off-campus account opening `/report` or replaying a queued report: Task 3 `checkReportCaller` test.
5. The same building typed twice by two off-campus accounts in one barangay ends up as one building: Task 1 SQL (`NULLS NOT DISTINCT`) and `matchBuildingByName`.

### Task 1: Data, places and scope

**Files:** Create `prisma/manual/DRRM-026-off-campus-accounts.sql`. Modify `prisma/schema.prisma` (User, Building), `src/lib/building-place.ts`, `src/lib/admin-scope.ts`, and every caller `npm run type-check` lists. Test `src/lib/building-place.test.ts`, `src/lib/admin-scope.test.ts`.

**Produces:** `users.is_off_campus`, `address`, `organization`, `organization_address`, `position_title`; `BuildingPlace.campus: Named | null`; `offCampusPool(campusId: string | null): Prisma.BuildingWhereInput` = `{ unit_id: null, campus_id: campusId }` (null means no campus, unlike `offCampusBuildings(null)` which means every campus); `inScope(scope, campusId: string | null)`.

- [ ] SQL: the user columns and `chk_users_off_campus` (an off-campus user has no campus, cluster, unit or position); relax `chk_buildings_place` so an off-campus building's `campus_id` may be null; recreate `uq_buildings_campus_barangay_name` with `NULLS NOT DISTINCT`. Idempotent.
- [ ] Failing tests: `toBuildingPlace` of an off-campus row with no campus gives `campus: null`; `offCampusPool(null)` deep-equals `{ unit_id: null, campus_id: null }`; `inScope` is true for a null campus only when the scope is all campuses.
- [ ] Implement, fix what `npm run type-check` lists (a null campus shows as "Off-campus accounts" where a campus name is printed), run `npm run test`, commit.

### Task 2: Accounts and off-campus setup

**Files:** Modify `src/lib/schemas.ts`, `src/actions/users/index.ts`, `src/components/hooks/use-users.ts`, `src/app/(admin)/users/_components/user-drawer.tsx`, `src/components/auth/profile-setup.tsx`, `src/components/auth/profile-drawer.tsx`. Create `src/components/auth/off-campus-setup.tsx`. Test `src/lib/schemas.test.ts`.

**Produces:** `offCampusProfileSchema` (first and last name, address, organization, organization address, position title: required, trimmed, at most 200 characters; `consent: true` required); `userBaseSchema.is_off_campus` with `campus_id` required only when it's false; `createUser(data, token)` refusing `is_off_campus` unless the token is a Super Admin's and the type is ERT Member; `completeOffCampusProfile(token, data): Promise<{ ok: true; user } | { ok: false; error: string }>`.

- [ ] Failing schema tests for both rules, then implement.
- [ ] Drawer: an **Off-campus account** switch for a Super Admin creating an ERT Member, hiding campus, cluster, unit and position; editing an off-campus user shows its five fields.
- [ ] `ProfileSetup` renders `OffCampusSetup` when `is_off_campus`, with the privacy notice and consent; the profile drawer shows organization, position and address for them.
- [ ] Type-check, lint, tests, commit.

### Task 3: Report off for off-campus accounts

**Files:** Modify `src/lib/access.ts`, `src/lib/report-caller.ts`, `src/app/(ert)/home/page.tsx`, `src/app/(ert)/_components/top-bar.tsx`, `src/app/(ert)/report/page.tsx`. Test `src/lib/access.test.ts`, `src/lib/report-caller.test.ts`.

**Produces:** `canUseReport(p): boolean` (false when `is_off_campus`); `checkReportCaller` refuses an off-campus owner with `retry: false` and the exact message.

- [ ] Failing tests for both, then implement.
- [ ] Home: the Status report card greyed, not a link, with the message. Top bar: Report greyed and not a link. `/report`: the message instead of the form. The hero eyebrow shows the organization.
- [ ] Type-check, lint, tests, commit.

### Task 4: Assessments for off-campus accounts

**Files:** Modify `src/lib/assessment-caller.ts`, `src/lib/assessment-draft.ts`, `src/actions/assessments/index.ts`, `src/components/hooks/use-assessments.ts`, `src/app/(ert)/assessment/_components/assessment-hub.tsx`, `assessment-stepper.tsx`, `details-step.tsx`. Test `src/lib/assessment-caller.test.ts`, `src/lib/assessment-draft.test.ts`.

**Produces:** `checkAssessmentCaller` → `{ ok: true; profile; campusId: string | null }`, null only for an off-campus account (a UP account without a campus is still refused); `newDraft({ …, location_kind?: BuildingCategory | null })`; `useAssessmentSetup(campusId?: string, offCampus?: boolean)` cached as `setup:off-campus`.

- [ ] Failing tests: an off-campus account passes with `campusId: null`; a UP account with no campus is still refused; `newDraft` with `location_kind: 'off_campus'` starts off campus.
- [ ] Server: setup returns the no-campus pool and no clusters or events; submit resolves buildings in `offCampusPool(campusId)`, refuses a campus building or an event for an off-campus account.
- [ ] Details step: no On/Off choice and the exact results line for an off-campus account.
- [ ] Type-check, lint, tests, build, commit.

### Task 5: Docs

- [ ] Update `auth`, `users`, `assessments`, `campus-scoping`, `database` module notes and `docs/changelog.md`; set this plan to in-review. Commit.
