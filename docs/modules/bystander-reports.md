---
type: module
updated: 2026-10-29
module: bystander-reports
paths:
  - src/actions/emergency-reports/index.ts
  - src/components/hooks/use-bystander-reports.ts
  - src/lib/bystander-photos.ts
  - src/app/(public)/bystander-report
  - src/app/(admin)/emergency-reports
tags: [module]
---

# Bystander reports

Anyone on campus can report an emergency without signing in, usually by scanning a QR code that opens `/bystander-report`. The form takes the incident type, campus, cluster and map pin, then optional people, damage, headcount, a contact number and up to 3 photos. Administrators and Super Admins triage these reports on `/emergency-reports` (named "Bystander reports" in the nav).

**Related:** [[architecture]] · [[field-reports]] · [[offline-pwa]] · [[dashboard]] · [[campus-scoping]] · [[pillars-and-landing]] · [[database]]

## Where it lives

| Path                                                                 | What it holds                                                                                  |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/actions/emergency-reports/index.ts`                             | Create, list, status change, delete, photo URLs, incident types                                |
| `src/lib/bystander-photos.ts`                                        | Server-only Storage helpers for the private `bystander-photos` bucket                          |
| `src/lib/photo-storage.ts`                                           | `photoBucket` (upload, remove, sign) and the JPEG metadata stripper, shared with field reports |
| `src/components/hooks/use-bystander-reports.ts`                      | Query/mutation hooks                                                                           |
| `src/app/(public)/bystander-report/page.tsx`                         | Public page shell (light only)                                                                 |
| `src/app/(public)/bystander-report/bystander-report-form.tsx`        | `BystanderReportForm`: 3-step form and send / queue logic                                      |
| `src/app/(public)/bystander-report/_components/`                     | `StepWhatWhere`, `StepPeopleDamage`, `StepReview`, `ResultScreen`, location field              |
| `src/components/ds/photo-field.tsx`                                  | `PhotoField`: the photo picker, shared with the ERT report ([[field-reports]])                 |
| `src/components/ds/prepare-photo.ts`                                 | `preparePhoto`: scale to 1600px (1280px on field reports) and re-encode JPEG on the device     |
| `src/app/(admin)/emergency-reports/page.tsx`                         | Admin list with tabs and search                                                                |
| `src/app/(admin)/emergency-reports/_components/bystander-drawer.tsx` | Report detail drawer with status actions and photos                                            |

## Data

- `bystander_reports` (model name is the table name): `cluster_id`, `unit_id`, `latitude`, `longitude` (required), `incident_type_id`, `status_id`, `description`, `location_description`, `damage_condition_id`, `contact_number` (`+63...`, admin-only), `photo_paths` (object paths, max 3).
- `BystanderReportPopulationCount` (`bystander_report_population_counts`): headcount per category, `count >= 0`.
- `ReportCasualty` and `ReportMissingPerson`: shared with field reports through `bystander_report_id`.
- `bystander_incident_types`, `bystander_report_statuses`: lookups. Statuses used by name: `pending`, `reviewed`, `verified`, `dismissed`.
- Reads `Cluster` (for its campus), `CampusPopulationCategory`, `DamageCondition`, `CasualtyCondition`.
- Bucket and constraints come from `prisma/manual/DRRM-008-bystander-report-v2.sql`.

## Server actions

`src/actions/emergency-reports/index.ts`:

- `createBystanderReport(data, photos?)`: validates with `bystanderReportSchema`; sets status `pending`; keeps only counts > 0 for fields active at the cluster's campus; uploads photos first, then creates the row; removes the uploads if the row fails. Anonymous, no auth.
- `getBystanderReports(campusId?)`: everything the list and drawer need, newest first. Campus via `clusters.campus_id`.
- `updateBystanderReportStatus(id, statusName)`: `reviewed`, `verified` or `dismissed`.
- `getPendingBystanderCount(campusId?)`: reports with no status or `pending` (sidebar badge, dashboard tile).
- `deleteBystanderReport(id)`: deletes the row (people and counts cascade).
- `getBystanderPhotoUrls(id)`: one-hour signed URLs via `signBystanderPhotos`.
- `getBystanderIncidentTypes()`: active incident types.

None of the admin actions check the caller's role or campus.

`src/lib/bystander-photos.ts`: `uploadBystanderPhotos` (up to `BYSTANDER_MAX_PHOTOS` = 3, max 3 MB, JPEG only, metadata stripped by `stripJpegMetadata`), `removeBystanderPhotos`, `signBystanderPhotos`. It binds `photoBucket` from `src/lib/photo-storage.ts` to the bucket; that uses `supabaseAdmin` (service role).

## Client side

- `/bystander-report` (public, no auth). Steps: what and where (required), people and damage (optional), review and send. A single active campus is picked automatically. After sending, the next report keeps the same campus.
- After a report sends (or a queued one goes through), `ResultScreen` shows `RateAppDialog` until the app is rated on that browser ([[design-system]]). Unit is optional and lists No unit first; there is no Other here, since bystanders are anonymous.
- `/emergency-reports` (admin). Tabs: Needs action (pending + reviewed), Verified, Dismissed, All. Scoped by `useScopedCampusId()`.
- `BystanderDrawer` footer: Dismiss, Mark reviewed (pending only), Verify. Verified and dismissed reports only get Close.
- Hooks: `useBystanderReports`, `usePendingBystanderCount` (refetch every minute), `useUpdateBystanderReportStatus`, `useDeleteBystanderReport`, `useBystanderPhotoUrls` (stale after 50 min), `useGetBystanderIncidentTypes`. Mutations invalidate `bystander-reports`, `bystander-pending`, `dashboard`.
- Form schemas: `bystanderFormSchema` (form fields) and `bystanderReportSchema` (server payload) in `src/lib/schemas.ts`. `toPhContactNumber` normalises the number.

## Rules and gotchas

- Photos are stripped twice: the browser re-encodes through a canvas, and the server drops Exif/XMP/IPTC segments. A bad photo is skipped, never blocking the report.
- `bystander-photos` is private. Photos are only shown through signed URLs. Keep `bystander-photos.ts` out of `src/lib/index.ts` so it never reaches a client bundle.
- `deleteBystanderReport` does not remove the report's photos from Storage.
- Offline: the form calls `queueBystanderReport(payload, blobs)` when offline or on `isNetworkError`. `OfflineQueueProvider` replays with `createBystanderReport(payload, toBystanderPhotoFormData(photos))`. The form updates the pending count with `getQueuedReportCount()` (bystander queue only).
- A report with no `status_id` counts as pending (`bystanderStatusKey` in `(admin)/_lib/status.ts`).
- Name and age are optional for bystander people, unlike ERT people.
- The status and incident type tables are not in the Settings LOOKUPS map, so they have no admin screen.

## Decisions

- [[0001-server-actions-only]]: the public form also writes through a server action.
- [[0002-manual-sql-schema-changes]]: bucket, contact number check and counts table come from `DRRM-008-bystander-report-v2.sql`.
- [[0004-offline-queue-bundled-create]]: the queued entry is one create payload plus its photo blobs.
