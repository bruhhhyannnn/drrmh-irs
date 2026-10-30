---
type: module
updated: 2026-10-30
module: field-reports
paths:
  - src/actions/reports/index.ts
  - src/actions/population-categories/index.ts
  - src/lib/report-photos.ts
  - src/lib/report-caller.ts
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
| `src/lib/report-caller.ts`                              | `checkReportCaller`: who may write to a report (pure, tested)        |
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

`src/actions/reports/index.ts`. Only the photo actions check the caller (`createReport`, `createReportCasualty`, `deleteReportCasualty`, `getReportPhotoUrls`); the rest predate the caller-check rule and take scope from the client:

- `getReports(page, query?, campusId?, filters)`: 10 per page, search on reporter, cluster, unit, event; filter by `eventId` / `clusterId`; campus via `cluster.campus_id`.
- `getReport(id)`: full report with people, damage and headcount.
- `createReport(token, data, photos?)`: one nested create with missing persons, casualties and population counts, as the verified caller (`requireProfile` + `checkReportCaller`): `user_id` is the caller's profile, and a payload whose `user_id` is another account answers `{ ok: false, retry: true }` (a shared phone). Returns `{ ok: true, id, photoCount }` or `{ ok: false, error, retry }`. `data.id` is the report id, made once on the phone (`newUuid`) and kept by the offline queue: if that id is already the caller's report the call returns success without writing or uploading, and a unique violation from a concurrent replay counts as saved too (its uploads are removed). An id that is another account's report is refused (`retry: false`) without revealing anything about it. Older queued entries without an id get a server-made one. `photos` (FormData, see Rules) are uploaded inside the `try` so the rows hold the paths; the uploads are removed only when the row wasn't created. A `unit_name` (Unit → Other (please specify)) becomes the unit in that cluster, added when new (`unitIdForName`), so a queued report still replays as one payload. An optional `sent_at` (ms, capped at now) sets `submitted_at`: the offline queue passes the time the report was queued, so a report sent offline keeps its real time. Writes legacy columns through `mapPopulationCountsToLegacyColumns`.
- `saveReportEdits(id, data)`: validates with `reportSchema` minus `event_id` (casualties may carry their `id`, plus `removed_casualty_ids`); resolves `unit_name` the same way. In one interactive transaction it locks the report row (`SELECT ... FOR UPDATE`), reads the photos of `removed_casualty_ids`, replaces headcount and missing rows, updates casualties that kept their id, adds new ones and deletes only `removed_casualty_ids`. A casualty added since the form loaded keeps its row and photos. The removed casualties' photos are deleted after commit.
- `deleteReport(id)`: in one transaction locks the report, reads its photo paths and deletes it; the photos go after commit.
- `getReportPhotoUrls(token, reportId)`: one-hour signed URLs, `{ ok, damage, casualties: [{ id, name, condition, urls }] }`, for an admin (`requireAdmin`) with the report's campus in scope; `{ ok: false, error, retry }` on every failure (the check and lookup sit inside the `try`).
- `getMyReportForOngoingEvent(userId)`: the member's latest report on any Ongoing event.
- `getMyLatestReport(userId)`: last report on any event, shown when nothing is ongoing.
- `createReportCasualty(token, data, photos?)` returns `{ ok: true, id, photoCount }`, `deleteReportCasualty(token, id)` returns `{ ok: true }` and also deletes its photos. Only the report's owner or an admin whose scope covers the report's campus may (`checkReportCaller`); anyone else gets `{ ok: false, error, retry }`. The hooks throw on `ok: false`.
- `getReportCasualties`, `getReportMissingPersons`, `createReportMissingPerson`, `deleteReportMissingPerson`: single-row reads and edits used after submit.

`src/actions/population-categories/index.ts`: `getPopulationCategories`, `createPopulationCategory`, `updatePopulationCategory`, `getCampusPopulationCategories(campusId)` (active, ordered; used by the forms), `getCampusPopulationCategoryAssignments`, `getCampusPopulationCategoryCounts`, `addCampusPopulationCategory` (upsert, re-activates), `updateCampusPopulationCategory`, `deleteCampusPopulationCategory`, `reorderCampusPopulationCategories`. These revalidate `/settings/population-fields`.

## Client side

- `/reports` (admin). Uses `useReports`, `useDeleteReport`, `useEvents`, `useSettingsTable('clusters')`, scoped by `useScopedCampusId()`.
- `ReportDrawer` (admin). Add picks an ongoing event from `useOngoingEventOptions`; cluster, units and headcount fields follow that event's campus. Unit is optional: No unit first, Other (please specify) last, which opens Unit name and sends `unit_name`. Edit uses `useSaveReportEdits`.
- `/report` (ERT). Shows, in order: `SubmittedReport` if `useMyReport` finds one; `SavedOffline` if a pending queued report for this user exists; `OfflineFirstLoad`; `NoOngoingEvent` (with past report via `getMyLatestReport`); else `ErtReportForm`. Ongoing events are polled every 30 s.
- `ErtReportForm` saves a draft to `localStorage` key `irs:ert-report-draft:<userId>` after each change and drops it if its event is no longer ongoing. Photos aren't in the draft (only their count, so a restored draft says to add them again).
- Photos: up to 3 of the damage under the damage tiles, and up to 3 per casualty in the casualty `PeopleDrawer` (its `photos` prop), via the shared `PhotoField` ([[bystander-reports]]) at 1280 px. A field takes no more once the report's photos reach `REPORT_PHOTO_BUDGET_BYTES` (3.5 MB), and doesn't add a prepared photo over `REPORT_PHOTO_MAX_BYTES` (1.5 MB, also the server's per-file cap). A casualty's line shows "· n photos". When `photoCount` comes back lower than the photos sent, the ERT form and `SubmittedReport` show a warning toast.
- `PeopleDrawer` releases photo object URLs: for a person added in this visit and then removed, for the draft and this visit's people on Cancel, and for people passed in once a save takes them off. `onSave` may return a Promise; `false` or a rejection keeps the drawer open with the list as entered.
- After submit, `SubmittedReport` lets the member add or remove missing persons and casualties through the single-row hooks. Casualties are saved as a diff (remove the ones taken off, add the new ones with photos), so saved casualties keep their photos. The drawer stays open until every request has settled and succeeded. A new casualty saved by an earlier try is remembered (by entry), so trying again doesn't add it twice. Saved new casualties' photo URLs are revoked. Members see photo counts only, never the photos.
- `ReportDrawer` (admin Edit) shows `ReportPhotos` after Structural damage, through `useReportPhotoUrls` (stale after 50 min). The hook throws on `{ ok: false }`, so a failure isn't cached: reopening the report or focusing the window asks again, and `ReportPhotos` shows the query error. Edit sends `removed_casualty_ids` (the ids it loaded minus the ones kept). Admins can't add photos.
- A sent report (now, or from the offline queue) calls `useRateAppStore.reportSent()`, so `RateAppDialog` in `ErtFrame` asks to rate the app until the member has opened the form; Rate the app is also in the account menu ([[design-system]]).

## Rules and gotchas

- New reports go through `createReport` with everything nested in one payload, because the offline queue replays a single call. Keep new report data bundled that way. Photos ride along as `File`s named by place, `damage-1.jpg` or `casualty-<i>-1.jpg` (`reportPhotoFiles`, `toReportPhotoFormData`, `groupReportPhotos` in `src/lib/utils.ts`); the queue keeps the names.
- One `createReport` carries at most `REPORT_PHOTO_BUDGET_BYTES` of photos: Vercel refuses a request body over 4.5 MB, whatever `bodySizeLimit` says. The server drops photos past the budget or past 3 per place, and a photo that fails never blocks the report.
- Casualty photos are health information: only `getReportPhotoUrls` signs them, for admins. Keep them out of exports. `report-photos.ts` is server-only, like `bystander-photos.ts`.
- Deleting a casualty, report or event ([[events]]) deletes its photos (best effort, after the row). Report and event deletes and edits read the paths inside the same transaction as the delete, after a `FOR UPDATE` lock, so a casualty or report inserted meanwhile waits instead of leaving its photos behind. `photoBucket().remove` deletes in chunks of 1000 paths.
- Signed photo URLs (`/storage/v1/object/sign/`) are `NetworkOnly` in the service worker ([[offline-pwa]]), so photos never land in Cache Storage.
- Offline: both forms call `queueFieldReport` when `navigator.onLine` is false or `isNetworkError(err)` is true (the ERT form with its photo files as attachments). Both put the report `id` in the payload before the first online try and queue that same object. `OfflineQueueProvider` replays with `createReport(token, payload, toReportPhotoFormData(photos))`, only for the signed-in account's own entries (or ones with no `user_id`); a `retry` answer keeps the entry pending. Editing is online-only.
- The ERT form updates the pending count with `getAllQueuedCount()`. The admin `ReportDrawer` sums only bystander + field queue counts, so it leaves out queued assessments.
- "One report per member per ongoing event" is enforced in the UI only (`getMyReportForOngoingEvent`). `createReport` does not check for an existing report or that the event is ongoing.
- `getMyReportForOngoingEvent` does not take an event id. With two ongoing events it returns the newest report on either.
- The ERT page guards itself (signed out → `/signin`, admins → `/dashboard`, incomplete profile → `ProfileSetup`).
- Legacy flat count columns are still written for the 12 original codes (transitional shim in `src/lib/utils.ts`).
- Campus headcount fields are soft-removed (`is_active = false`) because old reports point at the category. `deleteCampusPopulationCategory` removes only the assignment row.
- `saveReportEdits` replaces headcount and missing-person rows, so their ids change on every edit; casualties keep theirs.

## Decisions

- [[0001-server-actions-only]]: reports are read and written only through server actions.
- [[0004-offline-queue-bundled-create]]: `createReport` takes casualties, missing persons and counts in one call.
- [[0009-table-driven-settings]]: casualty and damage conditions come from the generic lookup tables.
