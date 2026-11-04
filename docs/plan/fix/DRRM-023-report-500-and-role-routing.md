---
type: fix
ticket: DRRM-023
status: in-progress
branch: fix/DRRM-023-report-500-and-role-routing
modules:
  - '[[auth]]'
  - '[[routes]]'
  - '[[field-reports]]'
  - '[[database]]'
tags: [plan, fix]
---

# [DRRM-023] Fix Plan: Report 500s, endless sign-in loader, role routing

- **Status:** `[In Progress]`
- **Related Bugs / Audits:** [[plan/bugs/DRRM-023-report-500-and-role-routing]]
- **Target Branch / PR:** `fix/DRRM-023-report-500-and-role-routing`
- **Author:** Claude Code

---

## 1. Objective & Scope

Get status reports saving on production, make every sign-in end in a page or an error with a way out, and stop non-admins from mounting admin pages.

### Non-Goals

- Cookie sessions and a server-side redirect (`@supabase/ssr`). ERT pages must open offline from the cache, so this is a separate decision.
- Caller checks on the older read actions (`getUserByAuthId`, `getMyReportForOngoingEvent`, `getOngoingEvents`). They answer without a token, and that needs its own ticket.

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [x] `src/lib/prisma.ts`: `connectionTimeoutMillis: 8000`, so a stalled database fails the request.
- [x] `src/actions/reports/index.ts`: `createReport` logs a server fault and answers `reportSaveFailure(err)` instead of throwing.
- [x] `src/lib/report-caller.ts`: `reportSaveFailure`. A foreign key failure is `retry: false`; anything else is `retry: true`, so a queued report stays queued.

### 2.2 Frontend / Components

- [x] `src/lib/access.ts`: pure, tested `homePathFor`, `signInDestination`, `adminGuard`, `ertGuard`.
- [x] `ProtectedRoute`: uses `adminGuard` during render, so only `allow` mounts children. `isRedirecting` is gone.
- [x] `useErtAccess`: uses `ertGuard` and adds an `error` status. `/home`, `/report` and `/assessment` show `AccountLoadFailed`.
- [x] `AccountLoadFailed`: the Retry and Sign Out card, moved out of `ProtectedRoute`.
- [x] `SignInForm`: waits for the profile, then replaces to `signInDestination`. `?from=` applies to admins only and must be a path inside the app.
- [x] `AuthProvider`: one fetch per user at a time, ignores a superseded answer, 20 s limit, a fixed readable error.
- [x] `auth/callback`: the 20 s timeout now covers `provisionGoogleUser`.
- [x] `/report`: guarded by `useErtAccess`, with queries in `ReportScreens` behind it. `ReportLoadFailed` shows when events fail to load or a server fault hits the member's report. A dropped connection on the member's report still opens the form, which can save offline.

### 2.3 Database / Prisma

- [x] **Production:** ran `prisma/manual/DRRM-022-report-photos.sql` on 2026-11-04 and confirmed the columns, constraints and bucket. No schema change on this branch.
- [ ] Follow-up: `report_casualties` has RLS off and no policies. Turn RLS on as its own task.

---

## 3. Step-by-Step Execution Plan

1. [x] Apply the DRRM-022 SQL on production. This alone restores report saving.
2. [x] Tests first for the guards and `reportSaveFailure`, then the code.
3. [ ] Test the scenarios below, then merge.

---

## 4. Testing & Verification

- [x] Tests: `npm run test`
- [x] Type check: `npm run type-check`
- [x] Lint check: `npm run lint`
- [x] Build check: `npm run build`
- [x] Stalled database: the same query now rejects after about 8 s (it was still pending after 90 s).
- [ ] Manual test scenarios (not run yet: Postgres wasn't reachable from the shell used for this work):
  1. ERT email sign-in: lands on `/home`, with no `/dashboard` in history and no admin requests in the Network tab.
  2. ERT Google sign-in: lands on `/home`.
  3. Admin sign-in: lands on `/dashboard`. Signed out on `/events`, signing in returns to `/events`.
  4. ERT member opens `/dashboard` directly: goes to `/home` without mounting the admin shell.
  5. After the SQL is applied: an ERT member submits a report with a photo on a test event.
  6. With the database unreachable: sign-in ends on Account Loading Failed with Retry and Sign Out.
  7. Offline: a report queues and sends when back online.
