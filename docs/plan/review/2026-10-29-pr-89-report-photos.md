---
type: review
ticket: REV-2026-10-29
status: in-progress
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
- **Status:** `[In Progress]`
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
  - **Resolution:** Fixed on `DevJom/factory-002-address-findings-review`. `createReport`, `createReportCasualty` and `deleteReportCasualty` take the token first and verify it with `requireProfile`. `checkReportCaller` (`src/lib/report-caller.ts`, tested) allows the report's owner or an in-scope admin. `createReport` sets `user_id` from the verified profile, and another account's payload answers `retry: true`. Expected failures come back as `{ ok: false, error, retry }`.

- **Issue 2:** `Admin edits from a stale form delete newer casualty photos`
  - **Location:** `src/actions/reports/index.ts:255`
  - **Problem:** `saveReportEdits` deletes every current casualty whose id the client didn't send, and their photos with it. The admin `ReportForm` sets its casualty list once, from cached `['report', id]` data. The `useState` initialisers ignore the background refetch.
  - **Impact:** An admin opens Edit report. Meanwhile an ERT member adds casualty C with 3 injury photos. The admin changes the headcount and saves. C is in `before`, nothing claims its id, `deleteMany` drops the row and `removeReportPhotos` deletes C's photos from Storage for good.
  - **Suggested Fix:** Only delete casualties the admin removed in the form (send removed ids), or reject the save when the report changed after the form loaded.
  - **Resolution:** Fixed. The admin form sends `removed_casualty_ids` (ids it loaded minus ids it kept). `saveReportEdits` deletes only those, and only their photos, updating kept casualties in place, so a casualty added since the form loaded stays.

- **Issue 3:** `A replayed createReport makes a duplicate report`
  - **Location:** `src/app/(ert)/report/_components/report-form.tsx:260`
  - **Problem:** The server makes a new `randomUUID` on every call, so `createReport` has no idempotency key.
  - **Impact:** On flaky mobile data, the report and photos commit but the response is lost (`TypeError: Failed to fetch`). `isNetworkError` sends it to `saveOffline`, and the flush replays it, giving two reports for the same cluster and event with two copies of every photo. Multi-MB photo bodies make this window much larger.
  - **Suggested Fix:** Pass a client-made id (e.g. the queue entry id) to `createReport` and use it as the report id, so a replay is a no-op.
  - **Resolution:** Fixed. The ERT form and the admin drawer make the report id once (`newUuid`) before the first online try and queue the same payload. `createReport` checks the id before uploading and returns success if it exists; a unique violation from a concurrent replay counts as saved and its uploads are removed. Entries without an id still get a server-made one.

- **Issue 4:** `The service worker caches injury photos on admin devices`
  - **Location:** `src/app/(admin)/reports/_components/report-photos.tsx:80`
  - **Problem:** Signed Supabase URLs are loaded as cross-origin `<img>`s and links. next-pwa's `defaultCache` ends with a catch-all `({ sameOrigin }) => !sameOrigin` NetworkFirst rule (cache `cross-origin`, 32 entries, 1 hour). _Inferred, not checked in a browser._
  - **Impact:** On a shared DRRM-H office PC, each photo is stored in Cache Storage under its signed URL. Expiry is lazy, so the photos stay on disk after the URL expires and after sign-out, readable by anyone using that browser profile. This goes against the PR's own "health information" note.
  - **Suggested Fix:** Add a `NetworkOnly` runtime-caching rule for the Supabase Storage origin ahead of the defaults in `next.config.ts`.
  - **Resolution:** Fixed. `next.config.ts` has a `NetworkOnly` rule for `/storage/v1/object/sign/`, registered ahead of next-pwa's defaults (checked in the built `public/sw.js`). Confirmed on 2026-10-30 against `next start` in headless Chrome: with the service worker controlling the page, a signed `/storage/v1/object/sign/...` image left the `cross-origin` cache empty, while a control `/storage/v1/object/public/...` request was cached there. The app only signs with `createSignedUrls` (no transforms), so every photo URL takes the `/object/sign/` path.

---

### 3.2 ⚠️ High / Medium Priority (Optimizations & Edge Cases)

- **Issue 1:** `Deleting a large event can leave every photo in Storage`
  - **Location:** `src/actions/events/index.ts:105`
  - **Problem:** `deleteEvent` passes every photo path of every report in the event to one Storage `remove()` call. The delete endpoint caps a request at 1000 objects (confirmed in supabase/storage `src/storage/limits.ts`: `MAX_OBJECTS_PER_REQUEST = 1000`, the default per-tenant limit, enforced by `enforceDeleteObjectsLimit` when request hard limits are on), and `remove()` only logs the error.
  - **Impact:** A campus-wide drill with about 250 reports and their damage and casualty photos goes past 1000 paths. The event and reports are deleted, the error goes to `console.error`, and every photo stays in Storage with nothing pointing to it.
  - **Suggested Fix:** Remove paths in chunks of 1000.
  - **Resolution:** Fixed. `photoBucket().remove` deletes in chunks of 1000 paths (`photo-storage.test.ts`).

- **Issue 2:** `A failed photo load is cached for 50 minutes`
  - **Location:** `src/components/hooks/use-reports.ts:66`
  - **Problem:** `getReportPhotoUrls` returns failures as successful data (`{ ok: false }`), and `useReportPhotoUrls` keeps them fresh for 50 minutes.
  - **Impact:** If an admin opens a report while the token refreshes (`requireAdmin` → `signed_out`) or Storage signing fails briefly, the error stays. Reopening the drawer or focusing the window doesn't refetch, so the "Try again in a moment" message lasts until a page reload.
  - **Suggested Fix:** Throw on `{ ok: false }` inside the query function (or set `staleTime` to 0 for failures) so TanStack Query retries.
  - **Resolution:** Fixed. `useReportPhotoUrls` throws on `{ ok: false }`, so the failure isn't cached; `ReportPhotos` shows the query error.

- **Issue 3:** `Casualty edits are lost when saving fails`
  - **Location:** `src/app/(ert)/report/_components/submitted-report.tsx:130`
  - **Problem:** `saveCasualties` runs after the drawer has closed (`onSave` then `onClose`). On failure the new casualties and their photo blobs are thrown away with only a toast. A partial failure leaves the deletes applied and the creates missing. This path has no offline queue.
  - **Impact:** A member with no signal adds a casualty with 3 injury photos and taps Save changes. The toast says "Couldn’t save casualties" and the drawer reopens from `casualtyRows`, so the person and photos must be entered again.
  - **Suggested Fix:** Keep the drawer open (or keep the draft) until the save succeeds.
  - **Resolution:** Fixed. `PeopleDrawer` awaits `onSave` and stays open on `false` or a rejection. `saveCasualties` waits for every request, remembers new casualties saved by an earlier try so a retry doesn't add them twice, and returns whether all of it saved.

- **Issue 4:** `Photo paths are read outside the write that deletes the rows`
  - **Location:** `src/actions/reports/index.ts:224`
  - **Problem:** `saveReportEdits` reads `before`, and `deleteReport` / `deleteEvent` read `reportPhotoPaths`, before the delete runs and outside it.
  - **Impact:** A casualty committed by `createReportCasualty` between the read and the update is deleted by `deleteMany`, but it isn't in `photosById`, so its photos are never removed. The same happens to a report created between `deleteEvent`'s read and `event.delete`. Health photos stay in Storage with nothing pointing to them.
  - **Suggested Fix:** Read the paths in the same transaction as the delete.
  - **Resolution:** Fixed. `saveReportEdits`, `deleteReport` and `deleteEvent` lock the parent row(s) with `SELECT ... FOR UPDATE`, read the paths and delete inside one interactive transaction, and remove the photos after commit. The Prisma read moved out of `src/lib/report-photos.ts` (3.3.3).

- **Issue 5:** `Dropped photos aren't reported to the client`
  - **Location:** `src/actions/reports/index.ts:164`
  - **Problem:** Photos the server drops (over 1.5 MB, over the 3.5 MB budget, not a JPEG, upload error) are skipped. Unlike `createBystanderReport`'s `photoCount`, neither `createReport` nor `createReportCasualty` returns how many were saved.
  - **Impact:** The client caps only the total size, not 1.5 MB per file, so one detailed photo or a Storage hiccup can drop images. The member sees "submitted" and assumes the injury photos reached the office.
  - **Suggested Fix:** Return the saved count, as the bystander action does, and warn when it is lower than what was sent. Also cap each file at 1.5 MB on the client.
  - **Resolution:** Fixed. `createReport` and `createReportCasualty` return `photoCount`; the ERT form and the submitted-report casualty save show a warning toast when fewer were saved. `PhotoField` takes `maxBytes`, and the report forms pass `REPORT_PHOTO_MAX_BYTES` (1.5 MB), which `report-photos.ts` uses too.

- **Issue 6:** `createReport's cleanup is wrong at both ends`
  - **Location:** `src/actions/reports/index.ts:200`
  - **Problem:** The uploads run before the `try`, so if one throws, the ones already uploaded are left behind. The `catch` deletes all uploads even when the failure comes after `prisma.report.create` succeeded.
  - **Impact:** A non-`StorageError` throw in one group's upload (e.g. a `photo.arrayBuffer` failure) rejects `Promise.all` and leaves the other groups' objects behind. Or the row commits, `revalidatePath` throws, the catch removes the photos and rethrows, and the client retries, creating a second report while the first points at deleted photos.
  - **Suggested Fix:** Track the paths uploaded so far inside the `try`, and only remove them when the create itself failed.
  - **Resolution:** Fixed. Uploads run inside the `try` and are tracked as they finish; `photoBucket().upload` no longer throws for one bad photo. The catch removes them only when the row wasn't created.

- **Issue 7:** `Object URLs for injury photos are never revoked`
  - **Location:** `src/components/ds/people-drawer.tsx:169`
  - **Problem:** URLs are not revoked when the drawer is cancelled with draft photos, when a casualty with photos is removed, or after `SubmittedReport` sends new casualties.
  - **Impact:** A member adds three casualties with 3 photos each, removes two and taps Done. `report-form`'s `photosRef` no longer holds them, so the unmount cleanup never revokes them. Each blob of about 300 KB stays in memory for the life of the page, which matters on low-end phones during long drills.
  - **Suggested Fix:** Revoke a photo's URL when it leaves the list, and revoke the drafts on cancel.
  - **Resolution:** Fixed. `PeopleDrawer` revokes on removing a person added this visit, on Cancel (draft and this visit's people), and on save for people passed in that were taken off. `SubmittedReport` revokes new casualties' photos once saved.

---

### 3.3 💡 Low Priority / Optional Improvements & Cleanups

- **Note 1:** `getReportPhotoUrls` returns `{ ok: false, error }` without `retry`, and `requireAdmin` and the Prisma lookup run outside the `try`, so their failures throw instead of being returned. CLAUDE.md asks for `{ ok: false, error, retry }`. (`src/actions/reports/index.ts:291`)
  - **Resolution:** Fixed. Every failure returns `retry`, and `requireAdmin` and the lookup sit inside the `try`.
- **Note 2:** Which casualty a photo belongs to depends only on the `File` name surviving every hop (IndexedDB, FormData, React `encodeReply`, busboy). A plain `Blob` gets named `photo-N.jpg`, and `groupReportPhotos` silently drops it. One FormData field per place (`damage`, `casualty-<i>`) would not depend on file names. (`src/lib/utils.ts:74`)
  - **Resolution:** Deferred. The ERT form always names its files, so nothing drops today.
- **Note 3:** `reportPhotoPaths` calls `prisma.report.findMany` from `src/lib/report-photos.ts`, not from a `'use server'` function under `src/actions/<domain>/`. (`src/lib/report-photos.ts:25`)
  - **Resolution:** Fixed with 3.2.4. The reads are in the actions; `reportPhotoPaths` only flattens the rows it is given.
- **Note 4:** `PhotoGroup` repeats the signed-URL thumbnail grid in `bystander-drawer.tsx`'s `Photos`. `toReportPhotoFormData` nearly repeats `toBystanderPhotoFormData` (and the bystander one drops file names). `photoFiles` repeats the FormData `File` filter in `createBystanderReport`. `PeopleDrawer`'s `photos?: { budgetBytes?: number }` is used as an on/off flag (`photos={{}}`). One shared signed-photo grid, one `toPhotoFormData(field, photos)` that keeps names, and a `photoBudgetBytes?: number` prop would cover it. (`src/app/(admin)/reports/_components/report-photos.tsx:63`)
  - **Resolution:** Deferred, a cleanup with no behaviour change.

---

## 4. Action Checklist & Next Steps

- [x] Fix 3.1.1–3.1.4 before merge (on `DevJom/factory-002-address-findings-review`, which merges `feat/DRRM-022-report-photos`).
- [x] Fix or ticket 3.2.1–3.2.7 (all fixed; 3.3.1 and 3.3.3 fixed, 3.3.2 and 3.3.4 deferred).
- [x] Confirm the two inferred points: Storage's per-request delete limit, and the `cross-origin` cache entries in DevTools → Application → Cache Storage after opening a report (both confirmed 2026-10-30; see 3.1.4 and 3.2.1).
- [x] Run verification (`npm run lint`, `npm run type-check`, `npm run test`, `npm run build`).
- [ ] Re-review and sign off.
