---
type: feature
ticket: DRRM-034
status: in-review
branch: feat/DRRM-034-admin-report-photos
modules:
  - '[[field-reports]]'
tags: [plan, feature]
---

# [DRRM-034] Feature Plan: Photos in the admin Add / Edit report drawer

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-034-admin-report-photos` → `dev`
- **Owner / Author:** Bryan Mangapit

---

## 1. Problem Statement & Motivation

Round 2, item 13 (Super Admin turn 9, screen **SA51**, parked in the design and built now on request). Since DRRM-022 ERT members can attach photos of the structural damage and of each casualty's injury, but admins can't: Add report has no photo fields, and Edit report only shows the saved photos in a read-only Photos section. An admin who files a report for a team, or fixes one, can't add or remove a photo.

**Users:** Administrators and Super Admins.

---

## 2. Requirements & User Stories

- **As an admin**, I want to attach damage and injury photos when I add a report, as the ERT form does.
- **As an admin**, I want to add or remove photos when I edit a report, without anything being deleted until I save.
- Acceptance criteria:
  - [x] Under Structural damage: `PhotoField` "Photos of the damage", up to 3, at 1280 px.
  - [x] The casualty `PeopleDrawer` gets the `photos` prop: "Photos of the injury", up to 3 per casualty.
  - [x] `PeopleDrawer` takes `allowEdit`: each listed person gets an Edit button that loads them into the form ("Edit Juan Ramos", Update casualty / Cancel edit). The person keeps their row id, so a saved casualty stays the same row with its photos. Used for casualties and missing persons in the admin drawer.
  - [x] Edit mode: saved photos show (signed links) with remove buttons, before the new ones, and count towards the 3. Removing one only takes it off the form; it is deleted from Storage when Update report saves.
  - [x] New photos are sent with the save, named as for `createReport` (`damage-n.jpg`, `casualty-<i>-n.jpg`). Add report sends them through `createReport`, and with no connection they go into the offline queue with the report, as on the ERT form.
  - [x] One save carries at most `REPORT_PHOTO_BUDGET_BYTES` (3.5 MB) of new photos (Vercel's 4.5 MB request limit; the server action limit is 8 MB). Saved photos don't count.
  - [x] If fewer new photos were saved than sent, a warning toast says so.
  - [x] If the photo links can't be loaded, the form still opens: those photos are kept, can't be removed, and the damage field says so.
  - [x] The read-only drawer (completed events) keeps its Photos section. Edit mode drops it, since the photos are now in their fields.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- None. `Report.damage_photo_paths` and `ReportCasualty.photo_paths` exist since DRRM-022.

### Server Actions & Data Flow

- `saveReportEdits(token, id, data, photos?)`: `damage_photo_paths` and each casualty's `photo_paths` list the saved photos to keep (unset keeps all). The server only keeps paths that are already that place's own, so a client can't attach another report's photo. New photos are uploaded before the transaction, at most as many as fit next to the kept ones; inside the transaction, under the existing `FOR UPDATE` lock, the saved photos are read again and merged (`mergePhotoPaths`). After commit, photos taken off, removed casualties' photos and uploads that didn't fit are deleted. If the write fails, only the uploads are deleted. Returns `photoCount` (new photos saved).
- A casualty id that isn't on the report takes no uploads.
- [`src/lib/report-photo-edits.ts`](../../../src/lib/report-photo-edits.ts): `keptPhotoPaths`, `newPhotoRoom`, `mergePhotoPaths`, pure and tested.
- `getReportPhotoUrls` also returns `byPath` (signed link by storage path), so the form can show and remove specific photos.
- `useSaveReportEdits` takes `photos` (`File[]`) and returns `{ report, photoCount }`.

### UI & User Interaction

- `PhotoField`: `saved` (`SavedPhoto[]`: `{ path, url }`) and `onRemoveSaved`.
- `CasualtyEntry.savedPhotos`; `personMeta` counts saved + new photos.
- `ReportDrawer` waits for the photo links when the report has photos, then builds the form with them.

---

## 4. Implementation Tasks

- [x] `PhotoField` saved photos, `PeopleDrawer` edit-in-place
- [x] `saveReportEdits` photos, `getReportPhotoUrls` `byPath`, hook
- [x] Report drawer: damage photos, casualty photos, create / offline / edit paths
- [x] Tests for the merge arithmetic (6)

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`, `npm run type-check`, `npm run test` (264 pass, 6 new), `npm run build`
- [x] Temporary preview of the casualty `PeopleDrawer` at 390 px with two saved photos: Edit loads the casualty, removing a saved photo and changing the diagnosis then Update casualty and Done gives the same id, the new diagnosis and only the kept path.
- [ ] Staging, signed in: Add report with damage and casualty photos (online and offline); Edit report: remove a saved photo, add a new one, Update report, then check the bucket (removed photo gone, new one there) and the read-only drawer.
- [x] Documentation: [[field-reports]], [[changelog]], [[00-index]].
