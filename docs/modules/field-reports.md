---
type: module
updated: 2026-10-29
module: field-reports
paths:
  - src/actions/reports/index.ts
  - src/actions/population-categories/index.ts
  - src/lib/report-photos.ts
  - src/components/hooks/use-reports.ts
  - src/components/hooks/use-population-categories.ts
  - src/app/(admin)/reports
  - src/app/(ert)/report
tags: [module]
---

# Field reports

A field report (status report) is one ERT team leader's headcount, casualties, missing persons and building damage for one cluster during one event, with optional photos of the damage and of each casualty's injury. ERT Members file it from `/report` on their phone, one per member per ongoing event, and it can be queued offline. Administrators and Super Admins see every report in scope on `/reports` and can add, edit or delete reports there.

**Related:** [[architecture]] · [[events]] · [[offline-pwa]] · [[settings-lookups]] · [[auth]] · [[campus-scoping]] · [[bystander-reports]] · [[database]]

## Where it lives

| Path                                                    | What it holds                                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/actions/reports/index.ts`                          | Report CRUD, ERT "my report" reads, casualty and missing person rows |
| `src/actions/population-categories/index.ts`            | Headcount field catalog and per-campus assignment                    |
| `src/lib/report-photos.ts`                              | Server-only Storage helpers for the private `report-photos` bucket   |
| `src/app/(admin)/reports/_components/report-photos.tsx` | `ReportPhotos`: the admin drawer's Photos section                    |
| `src/components/hooks/use-reports.ts`                   | Query/mutation hooks for reports, casualties, missing persons        |
| `src/components/hooks/use-population-categories.ts`     | Hooks for headcount fields (also used by Settings)                   |
| `src/app/(admin)/reports/page.tsx`                      | `/reports` list: search, event and cluster filters, server paging    |
| `src/app/(admin)/reports/_components/report-drawer.tsx` | `ReportDrawer`: admin Add report / Edit report                       |
| `src/app/(ert)/report/page.tsx`                         | `/report`: picks which screen the ERT member sees                    |
| `src/app/(ert)/report/_components/report-form.tsx`      | `ErtReportForm`: the one-page status report                          |
| `src/app/(ert)/report/_components/submitted-report.tsx` | `SubmittedReport`: read view, people still editable                  |
| `src/app/(ert)/report/_components/notice-screens.tsx`   | `NoOngoingEvent`, `OfflineFirstLoad`, `SavedOffline`                 |
| `src/app/(ert)/report/_lib/draft.ts`                    | `loadDraft` / `saveDraft` / `clearDraft` in `localStorage`           |
| `src/app/(ert)/_lib/use-field-queue.ts`                 | `useFieldQueue`: field reports waiting in IndexedDB                  |

## Data

- `Report` (`reports`): `event_id`, `user_id`, `cluster_id`, `unit_id`, `latitude`, `longitude`, `location_name`, `damage_condition_id`, `damage_photo_paths` (max 3), `submitted_at`. Also 12 legacy count columns (`faculty_members`, `students`, ...).
- `ReportPopulationCount` (`report_population_counts`): one row per `(report_id, category_id)` with `count`.
- `ReportCasualty` (`report_casualties`): `name`, `age`, `sex`, `diagnosis`, `condition_id`, `photo_paths` (max 3, field reports only). `report_id` or `bystander_report_id` is set.
- Photos: object paths `<reportId>/<uuid>.jpg` in the private `report-photos` bucket. Columns, `CHECK`s and bucket come from `prisma/manual/DRRM-022-report-photos.sql`.
- `ReportMissingPerson` (`report_missing_persons`): `name`, `age`, `sex`. Shared with bystander reports the same way.
- `PopulationCategory` (`population_categories`): `code`, `name`, `is_active`. Site-wide catalog.
- `CampusPopulationCategory` (`campus_population_categories`): which fields a campus uses, with `sort_order`, `is_required`, `is_active`.
- Reads `DamageCondition`, `CasualtyCondition`, `Cluster`, `Unit`, `Event`.

## Server actions

`src/actions/reports/index.ts` (no auth checks except `getReportPhotoUrls`; scope comes from the caller):

- `getReports(page, query?, campusId?, filters)`: 10 per page, search on reporter, cluster, unit, event; filter by `eventId` / `clusterId`; campus via `cluster.campus_id`.
- `getReport(id)`: full report with people, damage and headcount.
- `createReport(data, photos?)`: one nested create with missing persons, casualties and population counts. `photos` (FormData, see Rules) is uploaded first so the rows hold the paths; the uploads are removed if the create fails. A `unit_name` (Unit → Other (please specify)) becomes the unit in that cluster, added when new (`unitIdForName`), so a queued report still replays as one payload. An optional `sent_at` (ms, capped at now) sets `submitted_at`: the offline queue passes the time the report was queued, so a report sent offline keeps its real time. Writes legacy columns through `mapPopulationCountsToLegacyColumns`.
- `saveReportEdits(id, data)`: validates with `reportSchema` minus `event_id` (casualties may carry their `id`); resolves `unit_name` the same way; replaces headcount, missing and casualty rows in one update. A casualty sent with its id keeps its photos; the photos of casualties taken off are deleted.
- `deleteReport(id)`: deletes the report, then its photos (`reportPhotoPaths`).
- `getReportPhotoUrls(token, reportId)`: one-hour signed URLs, `{ ok, damage, casualties: [{ id, name, condition, urls }] }`, for an admin (`requireAdmin`) with the report's campus in scope; `{ ok: false, error }` otherwise.
- `getMyReportForOngoingEvent(userId)`: the member's latest report on any Ongoing event.
- `getMyLatestReport(userId)`: last report on any event, shown when nothing is ongoing.
- `getReportCasualties`, `createReportCasualty(data, photos?)`, `deleteReportCasualty` (also deletes its photos), `getReportMissingPersons`, `createReportMissingPerson`, `deleteReportMissingPerson`: single-row edits used after submit.

`src/actions/population-categories/index.ts`: `getPopulationCategories`, `createPopulationCategory`, `updatePopulationCategory`, `getCampusPopulationCategories(campusId)` (active, ordered; used by the forms), `getCampusPopulationCategoryAssignments`, `getCampusPopulationCategoryCounts`, `addCampusPopulationCategory` (upsert, re-activates), `updateCampusPopulationCategory`, `deleteCampusPopulationCategory`, `reorderCampusPopulationCategories`. These revalidate `/settings/population-fields`.

## Client side

- `/reports` (admin). Uses `useReports`, `useDeleteReport`, `useEvents`, `useSettingsTable('clusters')`, scoped by `useScopedCampusId()`.
- `ReportDrawer` (admin). Add picks an ongoing event from `useOngoingEventOptions`; cluster, units and headcount fields follow that event's campus. Unit is optional: No unit first, Other (please specify) last, which opens Unit name and sends `unit_name`. Edit uses `useSaveReportEdits`.
- `/report` (ERT). Shows, in order: `SubmittedReport` if `useMyReport` finds one; `SavedOffline` if a pending queued report for this user exists; `OfflineFirstLoad`; `NoOngoingEvent` (with past report via `getMyLatestReport`); else `ErtReportForm`. Ongoing events are polled every 30 s.
- `ErtReportForm` saves a draft to `localStorage` key `irs:ert-report-draft:<userId>` after each change and drops it if its event is no longer ongoing. Photos aren't in the draft (only their count, so a restored draft says to add them again).
- Photos: up to 3 of the damage under the damage tiles, and up to 3 per casualty in the casualty `PeopleDrawer` (its `photos` prop), via the shared `PhotoField` ([[bystander-reports]]) at 1280 px. A field takes no more once the report's photos reach `REPORT_PHOTO_BUDGET_BYTES` (3.5 MB). A casualty's line shows "· n photos".
- After submit, `SubmittedReport` lets the member add or remove missing persons and casualties through the single-row hooks. Casualties are saved as a diff (remove the ones taken off, add the new ones with photos), so saved casualties keep their photos. Members see photo counts only, never the photos.
- `ReportDrawer` (admin Edit) shows `ReportPhotos` after Structural damage, through `useReportPhotoUrls` (stale after 50 min). Admins can't add photos.
- A sent report (now, or from the offline queue) calls `useRateAppStore.reportSent()`, so `RateAppDialog` in `ErtFrame` asks to rate the app until the member has opened the form; Rate the app is also in the account menu ([[design-system]]).

## Rules and gotchas

- New reports go through `createReport` with everything nested in one payload, because the offline queue replays a single call. Keep new report data bundled that way. Photos ride along as `File`s named by place, `damage-1.jpg` or `casualty-<i>-1.jpg` (`reportPhotoFiles`, `toReportPhotoFormData`, `groupReportPhotos` in `src/lib/utils.ts`); the queue keeps the names.
- One `createReport` carries at most `REPORT_PHOTO_BUDGET_BYTES` of photos: Vercel refuses a request body over 4.5 MB, whatever `bodySizeLimit` says. The server drops photos past the budget or past 3 per place, and a photo that fails never blocks the report.
- Casualty photos are health information: only `getReportPhotoUrls` signs them, for admins. Keep them out of exports. `report-photos.ts` is server-only, like `bystander-photos.ts`.
- Deleting a casualty, report or event ([[events]]) deletes its photos (best effort, after the row).
- Offline: both forms call `queueFieldReport` when `navigator.onLine` is false or `isNetworkError(err)` is true (the ERT form with its photo files as attachments). `OfflineQueueProvider` replays with `createReport(payload, toReportPhotoFormData(photos))`. Editing is online-only.
- The ERT form updates the pending count with `getAllQueuedCount()`. The admin `ReportDrawer` sums only bystander + field queue counts, so it leaves out queued assessments.
- "One report per member per ongoing event" is enforced in the UI only (`getMyReportForOngoingEvent`). `createReport` does not check for an existing report or that the event is ongoing.
- `getMyReportForOngoingEvent` does not take an event id. With two ongoing events it returns the newest report on either.
- The ERT page guards itself (signed out → `/signin`, admins → `/dashboard`, incomplete profile → `ProfileSetup`).
- Legacy flat count columns are still written for the 12 original codes (transitional shim in `src/lib/utils.ts`).
- Campus headcount fields are soft-removed (`is_active = false`) because old reports point at the category. `deleteCampusPopulationCategory` removes only the assignment row.
- `saveReportEdits` replaces child rows, so row ids change on every edit.

## Decisions

- [[0001-server-actions-only]]: reports are read and written only through server actions.
- [[0004-offline-queue-bundled-create]]: `createReport` takes casualties, missing persons and counts in one call.
- [[0009-table-driven-settings]]: casualty and damage conditions come from the generic lookup tables.
