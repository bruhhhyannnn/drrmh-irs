---
type: fix
ticket: DRRM-050
status: in-review
branch: fix/DRRM-050-mass-assignment-closeout
modules:
  - '[[users]]'
  - '[[field-reports]]'
  - '[[settings-lookups]]'
tags: [plan, fix, security]
---

# [DRRM-050] Fix Plan: Close out #101 (mass assignment on user and report writes)

- **Status:** `[In Review]`
- **Related Bugs / Audits:** GitHub #101; `docs/plan/review/2026-11-10-project-security-audit.md` (3.1 Issue 2, 3.2 Issue 1). Builds on DRRM-045 (PR #126, users) and DRRM-046 (PR #127, reports), which both said "Part of #101".
- **Target Branch / PR:** `fix/DRRM-050-mass-assignment-closeout`
- **Author:** DevJom

---

## 1. Objective & Scope

After #126 and #127, the audit of `main` (commit `9b97dbc`) against every acceptance criterion in #101 and its two comments found three gaps. This ticket closes them and nothing else:

1. **`updateUser` accepted `email`.** The schema's shared write fields included it, and the Edit user drawer sent it. Issue #101 (comment 3, item 1) asks that `updateUser` never accept `email`.
2. **A typed unit outlived a failed report.** `saveNewReport` and `saveReportEdits` added a unit named under "Other (please specify)" before the report transaction, so a report that isn't saved (for example a duplicate caught under the lock) left the unit behind in Settings (#101 comment 2, item 3).
3. **No test pinned the report payload rules.** The nested-row, list-cap and unit-name rules from #101 comment 3 (items 3–5) were enforced in code but had no test.

Non-goals:
- Product choice left open: whether an administrator should be able to change a user's sign-in email. This ticket follows the issue's explicit rule (refuse it) and makes the email read-only on Edit user. If the owner wants email editing, that is a separate feature that must also update Supabase Auth.
- `updateUser` can still set `is_active` without the sign-in ban that `setUserActive` applies (#104). Requests are refused for an inactive profile either way (`requireProfile`), so this is noted, not changed here.

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [x] `src/lib/schemas.ts`: `email` moved out of the shared write fields. `userCreateInputSchema` adds it back (Add user sets it); `userUpdateInputSchema` (`.strict()`) refuses it.
- [x] `src/lib/lookup-names.ts`: new `unitIdForNameIn(tx, clusterId, name)`. It runs inside the caller's transaction, finds the unit first (case-insensitive, as `unitIdForName` does), and otherwise inserts with `ON CONFLICT DO NOTHING`. A plain unique-violation error would abort the whole transaction, so the DRRM-048 race fix (a unit typed at the same moment as another member's save) is kept.
- [x] `src/actions/reports/index.ts`: `reportUnitIdIn(tx, ...)` replaces `reportUnitId`. `saveNewReport` calls it after the duplicate check, inside the transaction. `saveReportEdits` calls it after the row lock, inside the transaction. A typed unit is therefore added only if the report is saved.

### 2.2 Frontend / Components

- [x] `src/app/(admin)/users/_components/user-drawer.tsx`: on Edit user the email field is read-only (hint "Set when the account is made") and is not sent. Add user is unchanged.

### 2.3 Database / Prisma

- [x] No schema change. The raw insert targets the existing `units` table (`id`, `name`, `cluster_id`; the column defaults fill the rest).

---

## 3. Step-by-Step Execution Plan

1. [x] Audit `main` against #101's body and both comments; write the checklist in section 4.
2. [x] Email out of `updateUser`; read-only on Edit user; tests updated.
3. [x] Unit creation moved inside the report transactions.
4. [x] Payload tests for `reportCreateSchema` (nested keys, length bomb, cap, unit name, uuids).
5. [x] Docs: this plan, `docs/changelog.md`, `docs/modules/users.md`, `docs/modules/field-reports.md`, `docs/modules/settings-lookups.md`.

---

## 4. Acceptance checklist for #101 (audit of `main` at `9b97dbc`, then this PR)

| # | Criterion (issue body or comment) | Status | Evidence |
|---|---|---|---|
| 1 | `completeUserProfile` ignores or rejects `user_type_id`, `auth_id`, `is_active`, `is_off_campus` and other non-setup fields | Met (#126) | `src/lib/schemas.ts` `completeProfileSchema` (`.strict()`); `src/actions/users/index.ts:385`; test `schemas.test.ts` "profile setup accepts only the campus, cluster, unit and position" |
| 2 | `completeUserProfile` refused once the profile is complete, and for admins (comment 1, item 1) | Met (#126) | `src/actions/users/index.ts:379` |
| 3 | `completeUserProfile` refused for off-campus accounts (comment 1, item 2) | Met (#126) | `src/actions/users/index.ts:376` |
| 4 | Profile setup: cluster on the campus, unit in the cluster, before a typed name is added (#86) | Met (#126) | `src/actions/users/index.ts:45-68` (`checkAssignment`), `:408` |
| 5 | `createUser` parses on the server and passes only whitelisted fields | Met (#126) | `src/actions/users/index.ts:266`, `:284`; `schemas.ts` `userCreateInputSchema` |
| 6 | `updateUser` parses on the server and passes only whitelisted fields | Met (#126) | `src/actions/users/index.ts:312`, `:322` |
| 7 | `updateUser` ignores or rejects `auth_id`, `email`, `is_profile_complete`, relation keys (comment 3, item 1; comment 2) | **Gap, fixed here** | Before: `email` in `userWriteFields`. Now: `schemas.ts` `userUpdateInputSchema` is strict without `email`; drawer `user-drawer.tsx:241` does not send it; test "Edit user refuses an email…" and the relation/`auth_id` loop in "Add user and Edit user refuse columns and relations…" |
| 8 | `createReport` validates with `reportSchema` / `reportCreateSchema` before anything else (issue, solution 3) | Met (#127) | `src/actions/reports/index.ts:244` |
| 9 | `event_id` in the caller's campus and Ongoing; `cluster_id` on that campus; `unit_id` in that cluster (issue; comment 3, item 2) | Met (#127) | `src/actions/reports/index.ts:303` (`checkNewReport`); `src/lib/report-caller.ts` `checkNewReport`; tests in `report-caller.test.ts` ("a member can't file on another campus's event…", "…upcoming or completed event…", "the cluster must be on the event campus…") |
| 10 | One report per member per event, enforced on the server (comment 3, item 2) | Met (#127) | `checkNewReport` `hasReport`; under `FOR UPDATE` lock at `src/actions/reports/index.ts:324-329`; test "one report per member per event…" |
| 11 | No unit created in a cluster outside the caller's campus (comment 3, item 3) | Met (#127), and the cluster check runs before any unit is added | `checkNewReport` (line 303) precedes `reportUnitIdIn`; saveReportEdits checks the cluster against `event_campus_id` before its transaction |
| 12 | A typed unit is not left behind when the report fails (comment 2, item 3) | **Gap, fixed here** | Before: `reportUnitId` ran before `prisma.$transaction`. Now: `reportUnitIdIn(tx, …)` at `src/actions/reports/index.ts:332` and `:514`; `unitIdForNameIn` in `src/lib/lookup-names.ts` |
| 13 | `unit_name` trimmed and length-capped (comment 2, item 3) | Met (#127) | `schemas.ts` `reportSchema.unit_name` = `typedText(120)`; test "a typed unit name is trimmed and capped at 120 characters" |
| 14 | Nested casualties and missing persons built from named fields, not a spread (comment 3, item 4) | Met (#127), and now tested | `src/actions/reports/index.ts:348`, `:351`; test "nested casualties and missing persons keep only their own fields" |
| 15 | `report_casualties: { length: 4294967295 }` fails before any allocation (comment 3, item 5) | Met (#127), and now tested | `reportCreateSchema` lists are `z.array(...).max(100)`, and parse runs before `groupReportPhotos` (`:313`); test "a report payload refuses a list that is not an array or runs past the cap" |
| 16 | `saveReportEdits` parses its payload (issue, solution 3) | Met (#127) | `src/actions/reports/index.ts:448` (`reportEditSchema`, built on `reportSchema`) |
| 17 | `saveReportEdits` cannot move a report to another event / cluster / unit outside scope (comment 3, item 2) | Met | `event_id` is omitted from `reportEditSchema`; cluster checked against `event_campus_id`; unit checked in the cluster (`src/actions/reports/index.ts:465-485`) |
| 18 | A unit test covers each payload above, in the style of `src/lib/report-caller.test.ts` (comment 3) | **Gap, fixed here** for the schema-level payloads; the action-level rules are covered by the `report-caller.test.ts` helpers | New tests in `src/lib/schemas.test.ts` ("Report payload" section); `report-caller.test.ts` is unchanged. Actions are not unit-tested in this repo (they need a database). |
| 19 | `npm run lint`, `type-check`, `test`, `build` pass | See section 5 | |

Known and not changed here: `updateUser` may set `is_active` without the sign-in ban (#104); see section 1.

---

## 5. Testing & Verification

- [x] Lint check: `npm run lint` (0 errors; the CRLF warnings come from this Windows checkout's `core.autocrlf`, not the change)
- [x] Type check: `npm run type-check`
- [x] Tests: `npm run test` (353 pass)
- [x] Build check: `npm run build`, run with placeholder Supabase and database values (the build only prerenders pages)
- [ ] Manual check on a database, not run here: a report with a new "Other (please specify)" unit that the server then refuses (for example a duplicate) leaves no unit in Settings; Edit user shows email read-only and still saves.
