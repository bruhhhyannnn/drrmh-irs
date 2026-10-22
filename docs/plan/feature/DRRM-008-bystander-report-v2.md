---
type: feature
ticket: DRRM-008
status: in-review
branch: feat/DRRM-008-bystander-report-v2
modules:
  - '[[bystander-reports]]'
  - '[[offline-pwa]]'
  - '[[data-layer]]'
tags: [plan, feature]
---

# [DRRM-008] Feature Plan: Bystander Report v2

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-008-bystander-report-v2`
- **Owner / Author:** Bryan Mangapit
- **Design source:** Claude Design project → `DRRM-H Redesign - Bystander.dc.html` (screens 24–28: web 1140 / tablet 768 / phone 390). Admin side follows SA13 in `DRRM-H Redesign - Super Admin.dc.html` for the new fields only.

---

## 1. Problem Statement & Motivation

The bystander form (`/bystander-report`) is one long page: a paragraph of intro, a privacy summary, eight cards and a dropdown for incident type. Someone reporting an emergency on a phone has to scroll past all of it, and 911 is only mentioned inside the privacy text.

The redesign splits the form into three steps in response order (what and where → people and damage → review), keeps Call 911 in the top bar, and adds three things responders asked for: a headcount, up to three photos of the damage, and an optional contact number.

---

## 2. Requirements & User Stories

- **As a bystander**, I want to send a report with the least effort: incident type, campus, location and cluster, then send.
- **As a bystander**, I want to add who is affected and photos of the damage when I can, and skip it when I can't.
- **As a bystander**, I want to check everything before sending, and know whether it was sent or saved offline.
- **As an admin**, I want to see the campus, headcount, photos and contact number on a bystander report.

Acceptance criteria:

- [x] Top bar: logos, "DRRM-H · IRS", "Life-threatening?" (tablet/web) and a Call 911 pill.
- [x] Step 1 holds only the required items: incident type (tile grid, 5 cols → 2 on phone), campus, location (map + Use my location + Pinned coordinates with Clear), cluster (required), unit (optional). Campus filters cluster and unit and decides the headcount fields.
- [x] Required marks are neutral grey; red only for real errors.
- [x] Step 2 is optional (Skip in the header): headcount steppers for the campus's categories, missing persons and casualties rows (Add / Manage), structural damage, up to 3 photos, location description, description.
- [x] Missing persons and casualties open a drawer (bottom sheet on phone): name optional (blank shows as "Unknown person"), age optional, sex in one tap, casualty condition as tiles, "What you can see" for diagnosis. Done also adds a filled draft.
- [x] Step 3 reviews every section with Edit links, asks for an optional contact number (+63 fixed), and shows the privacy line.
- [x] Privacy notice opens in the same drawer, over the current step. One sentence on photos and the contact number is added to the shared notice.
- [x] Offline: banner on every step; the button reads "Save report to send later"; photos are queued with the report.
- [x] Result screens: "Report received" (sent time, incident, photos, status) with Send another report / Back to home; "Report saved offline" with Call 911.
- [x] Photos are resized and re-encoded on the device (drops EXIF/GPS) and stripped again on the server before upload.
- [x] Admin detail shows campus, headcount, photos and contact number when present.
- [x] Light theme, Figtree + Spline Sans Mono, no horizontal scroll from 320px up.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

The schema changes ship as a hand-written SQL file the DB owner runs in Supabase: **`prisma/manual/DRRM-008-bystander-report-v2.sql`**. No `prisma db push` / `migrate` command is run from this branch.

- `bystander_reports.contact_number TEXT NULL`, checked as `+63` followed by 9–10 digits.
- `bystander_reports.photo_paths TEXT[] NOT NULL DEFAULT '{}'`, at most 3 entries. These are object paths in a **private** Storage bucket, not public URLs.
- New table `bystander_report_population_counts` (model `BystanderReportPopulationCount`), shaped like `report_population_counts` but keyed to `bystander_reports`. RLS is enabled with no policies, so only the `postgres` role (Prisma) can reach it.
- New private Storage bucket `bystander-photos` (JPEG only, 3 MB per file).
- **Campus is not stored**: it is derived from `cluster.campus_id`, so it can't disagree with the cluster.

### Server Actions & Data Flow

- `createBystanderReport(data, photos?: FormData)` (`src/actions/emergency-reports`):
  - Validates the payload with `bystanderReportSchema` (previously unvalidated and spread straight into Prisma).
  - Keeps only headcount categories active on the cluster's campus, and only counts above 0.
  - Strips JPEG metadata server-side, uploads photos under `<report id>/`, then creates the report. If the insert fails, the uploads are removed. A bad or failed photo is skipped instead of failing the whole emergency report, and the response says how many photos were saved.
  - Returns `{ id, submittedAt, photoCount }`.
- `getBystanderReports()` now includes campus (via cluster), headcount, and casualty conditions.
- `getBystanderPhotoUrls(id)` returns 1-hour signed URLs; the admin detail fetches them lazily via `useBystanderPhotoUrls`.
- `next.config.ts`: `experimental.serverActions.bodySizeLimit = '8mb'` so three photos fit in one call.
- Offline queue (`src/lib/offline-queue.ts`): entries gain optional `attachments: Blob[]`; `OfflineQueueProvider` replays bystander entries with their photos. Entries queued before this change have no attachments and replay as before.

### UI & User Interaction

- `src/app/(public)/bystander-report/`:
  - `page.tsx` is a server component that sets the fonts and renders the client form.
  - `bystander-report-form.tsx` holds the wizard state (react-hook-form + `bystanderFormSchema`, with people, counts and photos in local state) and submits.
  - `_components/`: `chrome` (top bar, hero band, cards, step header/footer), `fields` (labels, selects, inputs, pill button, option tiles, segmented control, stepper), `step-what-where` / `step-people-damage` / `step-review`, `location-field`, `photo-field`, `drawer`, `people-drawer`, `privacy-drawer`, `result-screen`.
  - `_lib/`: `prepare-photo` (resize to 1600px, re-encode to JPEG, drop metadata), `summary` (review/meta text), `campus-logo`.
- `src/lib/bystander-photos.ts` (server only): JPEG metadata strip, upload, cleanup, signed URLs.
- `src/components/common/map-pick.tsx`: `MapFlyTo` / `MapClickHandler`, moved out of `report-form.tsx` so the bystander form no longer imports the ERT form.
- `useUnits` takes `{ enabled }` so units load only once a cluster is chosen.
- `src/components/common/data-privacy-notice.tsx` exports the notice sections as data, so the bystander drawer and the existing modal render the same text.
- Breakpoints follow the design frames: phone = base, tablet = `md`, web = `lg`.

---

## 4. Implementation Tasks

- [x] Task 1: Schema + SQL file + `prisma generate`.
- [x] Task 2: Server action, photo upload/strip, signed URLs.
- [x] Task 3: Offline queue attachments + provider replay.
- [x] Task 4: Wizard UI (3 steps, drawers, results).
- [x] Task 5: Admin detail: campus, headcount, photos, contact.
- [x] Task 6: Responsive check at 1140 / 768 / 390 / 320.

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`: no new findings (one pre-existing warning in `users/user-form.tsx`).
- [x] `npm run type-check`: clean.
- [x] `npm run build`: `/bystander-report` and `/emergency-reports` prerender as static.
- [x] Headless Chrome walk-through at 1140 / 768 / 390 / 320 with sample lookup data (the dev DB was refusing connections): step 1 errors, filled steps 1–3, privacy, missing-person and casualty drawers, offline form and "Report saved offline". No horizontal overflow at any width.
- [x] Photos: a JPEG carrying an Exif/GPS block and a comment comes out of the browser step as a 1600px JPEG with neither, and `stripJpegMetadata` removes both server-side while keeping the image intact.
- [ ] Not run: an online submit and the admin detail with real data. Both need the SQL applied first.

**Rollout order:**

1. Run `prisma/manual/DRRM-008-bystander-report-v2.sql` in Supabase (creates the columns, table and bucket).
2. Deploy this branch. Deploying first breaks bystander reads and writes, because Prisma selects the new columns.

Open items:

- [ ] Server actions have no server-side auth check (true across `src/actions`). `getBystanderReports` and `getBystanderPhotoUrls` now return a contact number and photo links, so this is worth closing before release.
- [ ] The PWA install prompt renders above the drawers (same open item as DRRM-007).
- [ ] Lookups come from server actions, so a visitor who opens the form for the first time while offline can't pick a type, campus or cluster. This is unchanged from before.
- [ ] The full SA13 drawer redesign (status actions in the footer, headcount tiles) belongs to the Super Admin pass; this branch only adds the new fields to the current detail view.
