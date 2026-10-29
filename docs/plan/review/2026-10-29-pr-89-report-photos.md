---
type: review
ticket: REV-2026-10-29
status: in-review
branch: feat/DRRM-022-report-photos
modules:
  - '[[field-reports]]'
  - '[[offline-pwa]]'
  - '[[events]]'
tags: [plan, review]
---

# [REV-2026-10-29] Code Review & Audit: PR #89 report photos

- **Review Date:** 2026-10-29
- **Target Branch / PR / Files:** `PR #89` (`origin/main...origin/feat/DRRM-022-report-photos`, head `43679f3`)
- **Reviewer:** Claude Code (`/code-review`), requested by DevJom
- **Status:** `[In Review]`
- **Overall Recommendation:** `[Request Changes]`

---

## 1. Executive Summary

PR #89 adds photos to field reports: damage photos on the report and injury photos on each casualty. They go into the private `report-photos` bucket and admins see them through signed URLs. The review found 15 issues. Four should block the merge:

- the photo actions have no caller check
- a stale admin edit permanently deletes casualty photos
- a lost response makes the offline queue create a duplicate report
- the service worker caches health photos on admin devices

The review only read the code, in a temporary worktree. Lint, type-check, tests and the build were not run. Two points are inferred and not checked against Supabase: the 1000-path limit on Storage deletes (3.2.1) and that photo `<img>` requests land in next-pwa's `cross-origin` cache (3.1.4).

Line numbers refer to `43679f3`. Some of the files exist only on the PR branch.

---

## 2. Evaluation Matrix

| Category                       | Assessment | Key Notes                                                                    |
| :----------------------------- | :--------- | :--------------------------------------------------------------------------- |
| **Architecture & Conventions** | Warning    | Prisma read in `src/lib`, missing `retry` field, copied photo helpers        |
| **Correctness & Edge Cases**   | Fail       | Stale edits delete photos, duplicate reports on replay, cleanup gaps         |
| **Security & Authorization**   | Fail       | No caller check on photo actions, health photos cached by the service worker |
| **Database & Performance**     | Warning    | One Storage delete for a whole event, object URLs never revoked              |
| **State & Cache Invalidation** | Warning    | Failed photo URLs cached as fresh for 50 minutes                             |
| **UI/UX & Accessibility**      | Warning    | Casualty edits lost on failure, dropped photos not reported                  |

---

## 3. Detailed Findings

### 3.1 🚨 Critical / Blockers (Must Fix Before Merge)

- **Issue 1:** `No caller check on the photo actions`
  - **Location:** `src/actions/reports/index.ts:387`
  - **Problem:** `createReportCasualty` accepts up to 3 photo uploads and `createReport` about 12, into the private bucket. Neither checks the caller. `deleteReportCasualty` deletes a casualty's health photos without checking the caller either.
  - **Impact:** Server actions are public POST endpoints. Anyone can call `createReportCasualty` with any report id and keep adding 3 × 1.5 MB to Storage, attaching fake casualties with photos that admins then see as health information. Anyone can call `deleteReportCasualty` and permanently erase a real casualty's injury photos.
  - **Suggested Fix:** Take the token from `getAccessToken()` and verify it with `requireProfile` (ERT member) or `requireAdmin`, as the CLAUDE.md caller-check rule says. Check that the caller may write to that report.

- **Issue 2:** `Admin edits from a stale form delete newer casualty photos`
  - **Location:** `src/actions/reports/index.ts:255`
  - **Problem:** `saveReportEdits` deletes every current casualty whose id the client didn't send, and their photos with it. The admin `ReportForm` sets its casualty list once, from cached `['report', id]` data. The `useState` initialisers ignore the background refetch.
  - **Impact:** An admin opens Edit report. Meanwhile an ERT member adds casualty C with 3 injury photos. The admin changes the headcount and saves. C is in `before`, nothing claims its id, `deleteMany` drops the row and `removeReportPhotos` deletes C's photos from Storage for good.
  - **Suggested Fix:** Only delete casualties the admin removed in the form (send removed ids), or reject the save when the report changed after the form loaded.

- **Issue 3:** `A replayed createReport makes a duplicate report`
  - **Location:** `src/app/(ert)/report/_components/report-form.tsx:260`
  - **Problem:** The server makes a new `randomUUID` on every call, so `createReport` has no idempotency key.
  - **Impact:** On flaky mobile data, the report and photos commit but the response is lost (`TypeError: Failed to fetch`). `isNetworkError` sends it to `saveOffline`, and the flush replays it, giving two reports for the same cluster and event with two copies of every photo. Multi-MB photo bodies make this window much larger.
  - **Suggested Fix:** Pass a client-made id (e.g. the queue entry id) to `createReport` and use it as the report id, so a replay is a no-op.

- **Issue 4:** `The service worker caches injury photos on admin devices`
  - **Location:** `src/app/(admin)/reports/_components/report-photos.tsx:80`
  - **Problem:** Signed Supabase URLs are loaded as cross-origin `<img>`s and links. next-pwa's `defaultCache` ends with a catch-all `({ sameOrigin }) => !sameOrigin` NetworkFirst rule (cache `cross-origin`, 32 entries, 1 hour). _Inferred, not checked in a browser._
  - **Impact:** On a shared DRRM-H office PC, each photo is stored in Cache Storage under its signed URL. Expiry is lazy, so the photos stay on disk after the URL expires and after sign-out, readable by anyone using that browser profile. This goes against the PR's own "health information" note.
  - **Suggested Fix:** Add a `NetworkOnly` runtime-caching rule for the Supabase Storage origin ahead of the defaults in `next.config.ts`.

---

### 3.2 ⚠️ High / Medium Priority (Optimizations & Edge Cases)

- **Issue 1:** `Deleting a large event can leave every photo in Storage`
  - **Location:** `src/actions/events/index.ts:105`
  - **Problem:** `deleteEvent` passes every photo path of every report in the event to one Storage `remove()` call. The delete endpoint caps a request at 1000 prefixes (_inferred, not checked_), and `remove()` only logs the error.
  - **Impact:** A campus-wide drill with about 250 reports and their damage and casualty photos goes past 1000 paths. The event and reports are deleted, the error goes to `console.error`, and every photo stays in Storage with nothing pointing to it.
  - **Suggested Fix:** Remove paths in chunks of 1000.

- **Issue 2:** `A failed photo load is cached for 50 minutes`
  - **Location:** `src/components/hooks/use-reports.ts:66`
  - **Problem:** `getReportPhotoUrls` returns failures as successful data (`{ ok: false }`), and `useReportPhotoUrls` keeps them fresh for 50 minutes.
  - **Impact:** If an admin opens a report while the token refreshes (`requireAdmin` → `signed_out`) or Storage signing fails briefly, the error stays. Reopening the drawer or focusing the window doesn't refetch, so the "Try again in a moment" message lasts until a page reload.
  - **Suggested Fix:** Throw on `{ ok: false }` inside the query function (or set `staleTime` to 0 for failures) so TanStack Query retries.

- **Issue 3:** `Casualty edits are lost when saving fails`
  - **Location:** `src/app/(ert)/report/_components/submitted-report.tsx:130`
  - **Problem:** `saveCasualties` runs after the drawer has closed (`onSave` then `onClose`). On failure the new casualties and their photo blobs are thrown away with only a toast. A partial failure leaves the deletes applied and the creates missing. This path has no offline queue.
  - **Impact:** A member with no signal adds a casualty with 3 injury photos and taps Save changes. The toast says "Couldn’t save casualties" and the drawer reopens from `casualtyRows`, so the person and photos must be entered again.
  - **Suggested Fix:** Keep the drawer open (or keep the draft) until the save succeeds.

- **Issue 4:** `Photo paths are read outside the write that deletes the rows`
  - **Location:** `src/actions/reports/index.ts:224`
  - **Problem:** `saveReportEdits` reads `before`, and `deleteReport` / `deleteEvent` read `reportPhotoPaths`, before the delete runs and outside it.
  - **Impact:** A casualty committed by `createReportCasualty` between the read and the update is deleted by `deleteMany`, but it isn't in `photosById`, so its photos are never removed. The same happens to a report created between `deleteEvent`'s read and `event.delete`. Health photos stay in Storage with nothing pointing to them.
  - **Suggested Fix:** Read the paths in the same transaction as the delete.

- **Issue 5:** `Dropped photos aren't reported to the client`
  - **Location:** `src/actions/reports/index.ts:164`
  - **Problem:** Photos the server drops (over 1.5 MB, over the 3.5 MB budget, not a JPEG, upload error) are skipped. Unlike `createBystanderReport`'s `photoCount`, neither `createReport` nor `createReportCasualty` returns how many were saved.
  - **Impact:** The client caps only the total size, not 1.5 MB per file, so one detailed photo or a Storage hiccup can drop images. The member sees "submitted" and assumes the injury photos reached the office.
  - **Suggested Fix:** Return the saved count, as the bystander action does, and warn when it is lower than what was sent. Also cap each file at 1.5 MB on the client.

- **Issue 6:** `createReport's cleanup is wrong at both ends`
  - **Location:** `src/actions/reports/index.ts:200`
  - **Problem:** The uploads run before the `try`, so if one throws, the ones already uploaded are left behind. The `catch` deletes all uploads even when the failure comes after `prisma.report.create` succeeded.
  - **Impact:** A non-`StorageError` throw in one group's upload (e.g. a `photo.arrayBuffer` failure) rejects `Promise.all` and leaves the other groups' objects behind. Or the row commits, `revalidatePath` throws, the catch removes the photos and rethrows, and the client retries, creating a second report while the first points at deleted photos.
  - **Suggested Fix:** Track the paths uploaded so far inside the `try`, and only remove them when the create itself failed.

- **Issue 7:** `Object URLs for injury photos are never revoked`
  - **Location:** `src/components/ds/people-drawer.tsx:169`
  - **Problem:** URLs are not revoked when the drawer is cancelled with draft photos, when a casualty with photos is removed, or after `SubmittedReport` sends new casualties.
  - **Impact:** A member adds three casualties with 3 photos each, removes two and taps Done. `report-form`'s `photosRef` no longer holds them, so the unmount cleanup never revokes them. Each blob of about 300 KB stays in memory for the life of the page, which matters on low-end phones during long drills.
  - **Suggested Fix:** Revoke a photo's URL when it leaves the list, and revoke the drafts on cancel.

---

### 3.3 💡 Low Priority / Optional Improvements & Cleanups

- **Note 1:** `getReportPhotoUrls` returns `{ ok: false, error }` without `retry`, and `requireAdmin` and the Prisma lookup run outside the `try`, so their failures throw instead of being returned. CLAUDE.md asks for `{ ok: false, error, retry }`. (`src/actions/reports/index.ts:291`)
- **Note 2:** Which casualty a photo belongs to depends only on the `File` name surviving every hop (IndexedDB, FormData, React `encodeReply`, busboy). A plain `Blob` gets named `photo-N.jpg`, and `groupReportPhotos` silently drops it. One FormData field per place (`damage`, `casualty-<i>`) would not depend on file names. (`src/lib/utils.ts:74`)
- **Note 3:** `reportPhotoPaths` calls `prisma.report.findMany` from `src/lib/report-photos.ts`, not from a `'use server'` function under `src/actions/<domain>/`. (`src/lib/report-photos.ts:25`)
- **Note 4:** `PhotoGroup` repeats the signed-URL thumbnail grid in `bystander-drawer.tsx`'s `Photos`. `toReportPhotoFormData` nearly repeats `toBystanderPhotoFormData` (and the bystander one drops file names). `photoFiles` repeats the FormData `File` filter in `createBystanderReport`. `PeopleDrawer`'s `photos?: { budgetBytes?: number }` is used as an on/off flag (`photos={{}}`). One shared signed-photo grid, one `toPhotoFormData(field, photos)` that keeps names, and a `photoBudgetBytes?: number` prop would cover it. (`src/app/(admin)/reports/_components/report-photos.tsx:63`)

---

## 4. Action Checklist & Next Steps

- [ ] Fix 3.1.1–3.1.4 on `feat/DRRM-022-report-photos` before merge.
- [ ] Fix or ticket 3.2.1–3.2.7.
- [ ] Confirm the two inferred points: Storage's per-request delete limit, and the `cross-origin` cache entries in DevTools → Application → Cache Storage after opening a report.
- [ ] Run verification (`npm run lint`, `npm run type-check`, `npm run test`, `npm run build`).
- [ ] Re-review and sign off.
