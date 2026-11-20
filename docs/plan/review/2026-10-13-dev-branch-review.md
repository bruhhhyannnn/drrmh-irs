# [REV-2026-10-13] Code Review & Audit: dev vs main

- **Review Date:** 2026-10-13
- **Target Branch / PR / Files:** `dev` (`git diff main...HEAD`, 71 commits / 219 files, plus uncommitted `README.md`)
- **Reviewer:** Claude Code (`/code-review`)
- **Status:** `Draft`
- **Overall Recommendation:** `Request Changes`

---

## 1. Executive Summary

Correctness-focused review of the `dev` branch ahead of merging to `main`. Because of the diff size, the review concentrated on server actions, the offline queue, the ERT and admin report flows, the event summary model, bystander photos and campus scoping. The uncommitted `README.md` change (credits entry) has no issues. Lint, type-check and build were **not** run as part of this review.

The main risks are data loss when editing reports (non-atomic or over-broad replaces), event-completion rules that aren't enforced server-side, and authorization gaps in a few server actions (signed photo URLs, campus scoping fallback, client-supplied `completed_by`).

---

## 2. Evaluation Matrix

| Category                       | Assessment | Key Notes                                                                       |
| :----------------------------- | :--------- | :------------------------------------------------------------------------------ |
| **Architecture & Conventions** | Pass       | Server actions + TanStack hooks followed                                        |
| **Correctness & Edge Cases**   | Fail       | Headcount wipe on edit, blank-name validation, multi-event ERT lock-out         |
| **Security & Authorization**   | Fail       | Unauthenticated signed photo URLs, unscoped admin fallback, spoofable completer |
| **Database & Performance**     | Warning    | Non-atomic N deletes + M creates in ERT edits; duplicated dashboard query       |
| **State & Cache Invalidation** | Warning    | Reports filters not reset on campus switch; bystander badge stale after sync    |
| **UI/UX & Accessibility**      | Pass       | No issues found in reviewed areas                                               |

---

## 3. Detailed Findings

### 3.1 🚨 Critical / Blockers (Must Fix Before Merge)

- **Issue 1:** `Edit report wipes headcount rows not in the loaded category list`
  - **Location:** `src/app/(admin)/reports/_components/report-drawer.tsx:213`
  - **Problem:** Edit sends headcounts only for the campus's currently loaded active categories, and `saveReportEdits` replaces all `population_counts` (deleteMany then create).
  - **Impact:** Counts for deactivated/unlinked categories are deleted. If Update is clicked while `useCampusPopulationCategories` is loading or has failed, `categories` is `[]` and every headcount row is wiped.

- **Issue 2:** `Existing blank-name casualties block all edits`
  - **Location:** `src/actions/reports/index.ts:165`
  - **Problem:** `saveReportEdits` validates with `reportSchema`, whose casualty/missing-person schemas require `name.min(1)`, but legacy rows can have `name = ""`.
  - **Impact:** Such reports can't be edited at all until the casualty is deleted.

- **Issue 3:** `ERT missing/casualty edits aren't atomic`
  - **Location:** `src/app/(ert)/report/_components/submitted-report.tsx:108`
  - **Problem:** `saveMissing` / `saveCasualties` replace the list as N separate deletes followed by M separate creates.
  - **Impact:** On a flaky connection, deletes succeed and creates fail. Original rows are lost while the user sees "Couldn't save".

- **Issue 4:** `Completed-event lock isn't enforced`
  - **Location:** `src/app/(ert)/report/page.tsx:35`
  - **Problem:** `useMyReport` isn't polled, and `createReport` / `createReportCasualty` / `createReportMissingPerson` don't check that the event is still ongoing.
  - **Impact:** Members already on the page can keep editing after completion. Queued offline reports are accepted for completed events.

- **Issue 5:** `Signed photo URLs available without auth`
  - **Location:** `src/actions/emergency-reports/index.ts:152`
  - **Problem:** `getBystanderPhotoUrls` has no auth or role check.
  - **Impact:** Anyone with a report id (returned to the anonymous submitter) can get one-hour signed URLs to private-bucket photos.

### 3.2 ⚠️ High / Medium Priority (Optimizations & Edge Cases)

- **Issue 1:** `ERT member locked out of second ongoing event`
  - **Location:** `src/actions/reports/index.ts:213`
  - **Problem:** `getMyReportForOngoingEvent` matches a report on any ongoing event, though the form supports choosing between several.
  - **Suggested Fix:** Scope the lookup per event and show the submitted view only for the selected event.

- **Issue 2:** `Deleting a bystander report leaves photos in storage`
  - **Location:** `src/actions/emergency-reports/index.ts:142`
  - **Problem:** `deleteBystanderReport` never calls `removeBystanderPhotos`.
  - **Suggested Fix:** Read `photo_paths` before deleting and remove them afterwards.

- **Issue 3:** `Administrator with no campus sees all campuses`
  - **Location:** `src/app/(admin)/_components/shell/campus-switcher.tsx:25`
  - **Problem:** `useScopedCampusId` falls back to `''` (All campuses) when a non-super admin's `campus_id` is null.
  - **Suggested Fix:** Treat a missing campus as "no access" (or require a campus for Administrators), and enforce the scope server-side.

- **Issue 4:** `Reports filters survive campus switch`
  - **Location:** `src/app/(admin)/reports/page.tsx:59`
  - **Problem:** `eventId`, `clusterId` and `page` aren't reset when the campus scope changes.
  - **Suggested Fix:** Reset them when the scoped campus id changes.

- **Issue 5:** `completed_by trusted from client`
  - **Location:** `src/actions/events/index.ts:83`
  - **Problem:** `completeEvents` records a client-supplied user id.
  - **Suggested Fix:** Resolve the completer from the server-side session.

### 3.3 💡 Low Priority / Optional Improvements & Cleanups

- **Note 1:** Hardcoded dev IP `allowedDevOrigins: ['10.10.4.89']` (`next.config.ts`)
- **Note 2:** `getDashboard` duplicates the pending-bystander count instead of reusing `getPendingBystanderCount` (`src/actions/dashboard`)
- **Note 3:** Auth callback compares user-type strings by hand instead of `isAdminUserType`. `ProtectedRoute` still uses a deny-list of non-admin types.
- **Note 4:** Offline-queue flush doesn't invalidate `bystander-pending` / `dashboard` after bystander reports sync (`src/components/pwa/`)

---

## 4. Action Checklist & Next Steps

- [ ] Create fix plans under `docs/plan/fix/` for the critical items.
- [ ] Address required changes on `dev`.
- [ ] Run verification (`npm run lint`, `npm run type-check`, `npm run build`).
- [ ] Re-review and sign off.
