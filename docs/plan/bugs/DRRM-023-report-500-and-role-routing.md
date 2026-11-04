---
type: bug
ticket: DRRM-023
status: in-progress
branch: fix/DRRM-023-report-500-and-role-routing
modules:
  - '[[auth]]'
  - '[[routes]]'
  - '[[field-reports]]'
  - '[[database]]'
tags: [plan, bug]
---

# [DRRM-023] Headcount submit fails, sign-in hangs, ERT sign-in passes through the admin pages

- **Status:** `[In Progress]`
- **Severity:** `[Critical]` (ERT members can't submit a status report on production)
- **Affected Area:** `[Reports | Auth]`
- **Discovered Date:** 2026-11-04
- **Related PR / Commit:** production deploy `6c3041d` (2026-11-03); fix plan [[plan/fix/DRRM-023-report-500-and-role-routing]]

---

## 1. Description & Reproduction

### Summary

Three reports from the same session:

1. Submitting a headcount as an ERT member shows `Minified React error #441`. `/home` and `/report` log repeated `500` responses.
2. Signing in can stay on "Checking your access…" with no end.
3. Signing in as an ERT member renders the admin dashboard before landing on `/home`.

### Steps to Reproduce

1. Sign in on production as an ERT member and open `/report`. The console logs `POST /report 500`, and again on every window focus.
2. Fill in the report and submit. The form shows the #441 text.
3. For the hang: run the app against a database that accepts the connection but never answers, then sign in.

### Expected Behavior

The report saves, sign-in either finishes or shows an error with a way out, and an ERT member never mounts an admin page.

### Actual Behavior

See the summary. Without signing in, `getMyReportForOngoingEvent` answered `500` with digest `4042302669` every time, while `getUserByAuthId`, `getOngoingEvents` and `getMyLatestReport` answered `200` on the same deployment.

---

## 2. Root Cause Analysis (RCA)

### 2.1 The 500s: the DRRM-022 SQL was not applied to production

- **Files involved:** `prisma/manual/DRRM-022-report-photos.sql`, `src/actions/reports/index.ts`
- The DRRM-022 code selects `reports.damage_photo_paths` and `report_casualties.photo_paths`. Its SQL has to run first, on every database, and it wasn't run on production.
- **Evidence:**
  - Production's Storage buckets are only `bystander-photos`. The same transaction that adds the columns creates `report-photos`, so the transaction never ran.
  - The only failing read is the one selecting every `reports` column. `getMyLatestReport` also reads `reports`, with chosen columns, and works.
  - Confirmed on production: the same query through Prisma fails with `P2022`, ``The column `reports.damage_photo_paths` does not exist``. `information_schema` lists neither `reports.damage_photo_paths` nor `report_casualties.photo_paths`.
- **Before applying:** `report_casualties` has RLS off and no policies, which the SQL file says to check. PostgREST answers `permission denied for schema public` for the publishable key, so the table isn't readable through that API today. Turning RLS on is a separate decision.

Two defects made this worse:

- `createReport` threw on a server fault. Production hides thrown messages, so the member read #441, and the offline queue marked a queued report `failed` with that same text.
- `/report` treated a failed load as an empty result: a failed `useMyReport` opened the form, and a failed `useOngoingEvents` read as "No ongoing event".

### 2.2 The endless loader

- **Files involved:** `src/lib/prisma.ts`, `src/components/auth/auth-provider.tsx`, `src/app/(ert)/_lib/use-ert-access.ts`, `src/components/auth/protected-route.tsx`, `src/app/auth/callback/page.tsx`
- `PrismaPg` sets no `connectionTimeoutMillis`, and `pg` then waits without limit. Reproduced: a `user.findUnique` was still pending after 90 s with no error. `AuthProvider` stays `loading` and every later server action queues behind it, because Next runs them one at a time.
- The stall came from the developer's Wi-Fi (gateway `172.16.76.1`): TCP connected, but no Postgres server answered, Supabase or not, and neither did SSH to GitHub. On a phone hotspot, 20 of 20 connections succeeded in about 0.5 to 1.5 s, and the app's own Prisma queries ran with no failures.
- Whatever makes the database stall, these turned it into a loop:
  - `useErtAccess` ignored `profileError`, so a failed profile load on an ERT page stayed on "checking".
  - `ProtectedRoute` set `isRedirecting` and never cleared it.
  - The OAuth callback cleared its timeout before `provisionGoogleUser` ran.
  - `getSession` and `onAuthStateChange` could each start the same profile fetch.

### 2.3 ERT members rendering the admin pages

- **Files involved:** `src/app/(auth)/signin/sign-in-form.tsx`, `src/components/auth/protected-route.tsx`
- Email sign-in went to `?from=` or `/dashboard` for everyone, before the role was known.
- `ProtectedRoute` only redirected in an effect. On the render after the profile loaded it returned `children`, so the admin shell and dashboard mounted. Children's effects run before the parent's, so their queries could start before the redirect.
- `/report` had the same shape the other way round: it started its queries before checking for an admin.

### 2.4 Found while testing: the session pooler ran out of clients

- **Symptom:** `(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15`, on sign-in and on the admin reports list. It came and went.
- **Root cause:** `DATABASE_URL` used the session pooler (`:5432`), where each connected client keeps a slot, and the project allows 15. Each running copy of the app can open up to 10 (the `pg` default). A dev server alone can't reach 15, so other clients were holding slots too. Which ones wasn't identified, because the database sees them all as coming from the pooler.
- **Fix:** use the transaction pooler (`:6543`). With the app's Prisma setup, 25 parallel queries had no failures and an interactive transaction worked. Vercel's `DATABASE_URL` wasn't visible from here, so it has to be checked by hand: with `:5432`, a busy drill could hit this same limit.
- **Related:** the local `SHADOW_DATABASE_URL` pointed at production. It plays no part in this error, but see [[database]].

---

## 3. Proposed Fix & Link

- **Fix Plan:** [[plan/fix/DRRM-023-report-500-and-role-routing]]
- **Done on production (2026-11-04):** `prisma/manual/DRRM-022-report-photos.sql` was applied, and the failing query now works.
- **Verification Steps:** in the fix plan.
