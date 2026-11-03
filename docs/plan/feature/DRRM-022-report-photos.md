---
type: feature
ticket: DRRM-022
status: in-review
branch: feat/DRRM-022-report-photos
modules:
  - '[[field-reports]]'
  - '[[bystander-reports]]'
  - '[[offline-pwa]]'
  - '[[database]]'
  - '[[events]]'
tags: [plan, feature]
---

# [DRRM-022] Feature Plan: Photos on field reports

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-022-report-photos` → `dev`
- **Owner / Author:** Bryan Mangapit

---

## 1. Problem Statement & Motivation

ERT members can describe a casualty's condition only in words, and some can't name the injury well. Structural damage is one tile choice with no evidence behind it. The bystander form already takes up to 3 photos. The field report should take photos too: of each casualty's injury, as a fallback when the diagnosis is hard to describe, and of the structural damage.

---

## 2. Requirements & User Stories

- **As an ERT Member**, I want to add photos of an injury when I add a casualty, so that the office can see what I couldn't describe.
- **As an ERT Member**, I want to add photos of the structural damage, so that the damage I picked has evidence behind it.
- **As an Administrator**, I want to see a report's photos when I open it, so that I can judge the casualties and the damage.
- Key acceptance criteria:
  - [x] Up to 3 photos per casualty (casualty drawer, under Diagnosis) and 3 of the damage (under the damage tiles), from the camera or the gallery. All optional.
  - [x] Photos are scaled to 1280 px and re-encoded as JPEG on the phone, and the server strips JPEG metadata again, as on the bystander form.
  - [x] One report carries at most 3.5 MB of photos (`REPORT_PHOTO_BUDGET_BYTES`), because Vercel refuses a request body over 4.5 MB. The picker says when the report has no room left, and the server drops anything over the limit.
  - [x] A report sent offline keeps its photos in the queue and sends them with the report.
  - [x] After submitting, a member can still add casualties with photos. Saved casualties keep their photos; only removed ones are deleted.
  - [x] Admins see the photos in the report drawer (Edit report), grouped by damage and by casualty, through one-hour signed URLs. The action checks the admin's token and campus.
  - [x] An admin edit keeps each casualty's photos, and deletes the photos of casualties taken off.
  - [x] Deleting a casualty, a report or an event deletes its photos from Storage.
  - [x] Photos are not in the PDF or the NSED export.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- `Report.damage_photo_paths` and `ReportCasualty.photo_paths` (`TEXT[]`, default empty, max 3 by `CHECK`), plus a private `report-photos` bucket (JPEG only, 1.5 MB per file). All in [`prisma/manual/DRRM-022-report-photos.sql`](../../../prisma/manual/DRRM-022-report-photos.sql).
- **Run that file on staging and production before this code deploys.** Prisma selects the new columns, so report pages fail on a database without them.

### Server Actions & Data Flow

- [`src/lib/photo-storage.ts`](../../../src/lib/photo-storage.ts): `photoBucket(bucket, maxBytes)` with `upload`, `remove` and `sign`, and the JPEG metadata stripper, moved out of `bystander-photos.ts`. `bystander-photos.ts` and the new `report-photos.ts` bind it to their buckets. `reportPhotoPaths(where)` collects every photo on some reports, for deletes.
- Photos travel in one FormData field. Each file's name says whose photo it is: `damage-1.jpg`, or `casualty-<i>-1.jpg` for casualty `i` (`reportPhotoFiles`, `toReportPhotoFormData` and `groupReportPhotos` in `src/lib/utils.ts`, tested in `utils.test.ts`). The offline queue stores the `File`s as they are, so the names survive a replay. The report payload is unchanged, so the bundled-create rule ([[0004-offline-queue-bundled-create]]) still holds.
- `createReport(data, photos?)` uploads first under `<reportId>/`, then creates the report with the paths, and removes the uploads if the create fails. A bad photo is skipped and never blocks the report.
- `createReportCasualty(data, photos?)`, `deleteReportCasualty`, `deleteReport`, `saveReportEdits` (casualties may send their `id`) and `deleteEvent` handle the photos as above.
- `getReportPhotoUrls(token, reportId)` signs the URLs for an admin with the report's campus in scope, and returns `{ ok: false, error }` otherwise.

### UI & User Interaction

- `PhotoField` and `preparePhoto` moved from the bystander form to `src/components/ds/` and take a label, an id, a size limit and the longest edge. The bystander form looks and works as before.
- `PeopleDrawer` takes `photos` (casualties only) for the injury photos. Their note reads "Photograph the injury, not the face, where you can. Only DRRM-H admins can see these photos." A casualty's line shows "· 2 photos".
- ERT form: the damage photos sit under the tiles. Photos don't fit in the localStorage draft, so a restored draft says "Photos aren't kept in a draft, so add them again."
- Submitted report: "2 photos" on the damage tile and on each casualty. Members never see the photos again after sending.
- Admin `ReportDrawer`: a Photos section (`report-photos.tsx`) after Structural damage, with a note that casualty photos are health information.

---

## 4. Implementation Tasks

- [x] SQL file and `schema.prisma`
- [x] Shared photo storage, report photo actions and cleanup on delete
- [x] Photo field in `ds`, the ERT form, the casualty drawer, the submitted report, the admin drawer, offline replay
- [x] Verify: lint, type-check, `npm run test` (76 pass, 5 new), `npm run build`. In headless Chrome at 390 px, through a temporary preview route with no database and all server actions held: photos scale to 1280 px; the create request carries `damage-1/2` and `casualty-0-1`, `casualty-1-1..3`; with the connection cut, the report and its 6 named photos land in the offline queue and the draft is cleared; after submit, adding a casualty sends one `createReportCasualty` with its photo and doesn't delete the saved one; the admin Photos section and dark mode render.
- [ ] Apply `DRRM-022-report-photos.sql` on staging, then check end to end: upload, the admin view, deletes (photos gone from the bucket).
- [ ] Apply it on production before `dev` is merged to `main`.

## 5. Notes

- Not tested in the browser: the real upload to Storage (the bucket only exists once the SQL runs), and the "no room for more photos" message (the server-side limit is unit tested).
- Out of scope: admins can't add photos from Add report / Edit report; the event page doesn't show photos.
- Follow-ups: keep draft photos in IndexedDB so a reload doesn't lose them; `deleteBystanderReport` still leaves its photos in the `bystander-photos` bucket.
