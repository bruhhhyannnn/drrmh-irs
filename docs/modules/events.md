---
type: module
updated: 2026-10-28
module: events
paths:
  - src/actions/events/index.ts
  - src/components/hooks/use-events.ts
  - src/app/(admin)/events
  - src/app/(admin)/_lib/summary.ts
  - src/app/(admin)/_lib/status.ts
  - src/app/(admin)/_lib/nsed-report.ts
  - src/app/(admin)/_lib/nsed-docx.ts
  - public/templates/nsed-report.docx
  - src/app/(admin)/_components/summary
tags: [module]
---

# Events

Events are the drills and real incidents that field reports are filed against. Administrators create and run events for their own campus; Super Admins can create the same event at several campuses at once and complete it everywhere in one step. ERT Members never edit events, but they can only report while an event at their campus is Ongoing.

**Related:** [[architecture]] · [[field-reports]] · [[dashboard]] · [[campus-scoping]] · [[print]] · [[settings-lookups]] · [[database]]

## Where it lives

| Path                                                         | What it holds                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `src/actions/events/index.ts`                                | All event reads and writes, plus `getEventSummarySource`                       |
| `src/components/hooks/use-events.ts`                         | TanStack Query wrappers; `invalidateEventViews`                                |
| `src/app/(admin)/events/page.tsx`                            | `/events` list with status tabs, search, Export PDF per row                    |
| `src/app/(admin)/events/details/page.tsx`                    | `/events/details?id=` summary, Complete event dialog                           |
| `src/app/(admin)/events/_components/event-drawer.tsx`        | Add / Edit event drawer, `CampusChecklist`                                     |
| `src/app/(admin)/events/_components/delete-event-dialog.tsx` | Delete confirm that names linked report count                                  |
| `src/app/(admin)/_lib/summary.ts`                            | Pure event summary model: `buildSummary`, `compareSummaries`, timeline helpers |
| `src/app/(admin)/_lib/status.ts`                             | `eventStatusKey`, `eventTone`                                                  |
| `src/app/(admin)/_lib/nsed-report.ts`                        | `buildNsedReport`: the NSED report's fields from the summary source (tested)   |
| `src/app/(admin)/_lib/nsed-docx.ts`                          | `fillNsedTemplate`, `downloadNsedReport`: docxtemplater fill and download      |
| `public/templates/nsed-report.docx`                          | The UP Manila office's NSED report template (letterhead, wording, tags)        |
| `src/app/(admin)/_components/summary/`                       | `EventSummary`, `useSummary`, charts and sections                              |

## Data

- `Event` (`events`): `name`, `description`, `quarter`, `started_at`, `ended_at`, `status_id`, `campus_id`, `user_id` (creator), `completed_by` (who completed it; added in `prisma/manual/DRRM-011-super-admin-v2.sql`).
- `EventStatus` (`event_statuses`): looked up by name. Code expects `upcoming`, `ongoing`, `completed` (case-insensitive).
- `Report` (`reports`): read for counts and the summary. `Report.event` has `onDelete: Cascade`.
- `Cluster` (`clusters`) and `CampusPopulationCategory` (`campus_population_categories`): read by `getEventSummarySource` (active only).

## Server actions

`src/actions/events/index.ts` (no auth or campus check inside; callers pass the scope):

- `getEvents(query?, campusId?)`: list with status, campus and report count; newest start first.
- `getEvent(id)`: one event with status, campus, completer and report count.
- `createEvents(data, campusIds)`: one event per ticked campus in a single `$transaction` (all or nothing).
- `updateEvent(id, data)`: plain update.
- `completeEvents(ids, userId)`: sets status Completed, `ended_at` now, `completed_by`. Throws if the Completed status is missing.
- `deleteEvent(id)`: deletes the event; its reports go with it (cascade).
- `getOngoingEvents(campusId)`: ongoing events at one campus (ERT `/home` and `/report`).
- `getOngoingEventOptions(campusId?)`: ongoing events for the admin Add report drawer.
- `getSiblingOngoingEvents(eventId)`: same-name ongoing events at other campuses.
- `getCampusEventOptions(campusId)`: all events at a campus, for "Compare with".
- `getEventSummarySource(eventId)`: event, its reports (people, damage, headcount), active clusters and active population fields.

Every mutation calls `revalidatePath` on `/events`, `/events/details` and `/dashboard`.

## Client side

- Routes: `/events` (tabs All / Ongoing / Upcoming / Completed), `/events/details?id=`, and `/events?add=1` (opens Add event, used by the dashboard).
- Hooks: `useEvents`, `useEvent`, `useCreateEvents`, `useUpdateEvent`, `useCompleteEvents`, `useDeleteEvent`, `useOngoingEvents` (optional `refetchInterval`), `useOngoingEventOptions`, `useSiblingOngoingEvents`, `useCampusEventOptions`, `useEventSummarySource`.
- Mutations invalidate `events`, `event`, `event-summary`, `event-siblings`, `event-compare-options`, `dashboard`, `campus-overview`, `campuses-overview`.
- Form: `eventSchema` in `src/lib/schemas.ts` (`campus_ids` array, end must be after start).
- Campus scope comes from `useScopedCampusId()` and `useIsSuperAdmin()` in `(admin)/_components/shell/campus-switcher.tsx`. `useEventTitle()` shows "Name — Campus" to Super Admins only.
- Export PDF (event details, and the download icon on each `/events` row and phone card) opens `/events/report?id=` in a new tab (see [[print]]). The Excel export was removed in DRRM-018.
- Export NSED report (event details only, when the event is completed and its campus is UP Manila, `isUpManila`): the office's quarterly NSED report as a Word file. `downloadNsedReport` is imported on click, fetches `public/templates/nsed-report.docx`, fills it with `buildNsedReport(source)` through docxtemplater + pizzip and saves `NSED Report Q1 2026.docx`. The app fills what it records (date and times, headcount per cluster, the timeline, the summary, one breakdown and note per cluster, headcount by category); the rest are yellow `[Add …]` blanks for the office. Tags and rules: [[plan/feature/DRRM-019-nsed-report]].
- The event "calendar" is the This month card on the dashboard (`MonthCard` in `(admin)/dashboard/page.tsx`), fed by `getDashboard`. There is no separate calendar page.

## Rules and gotchas

- Status is matched by name, not id. Renaming a status in the database away from Upcoming / Ongoing / Completed breaks filtering, tabs and ERT reporting.
- A multi-campus event is N separate rows with the same name. Siblings are found by exact `name` match, so editing one name detaches it from "Also complete it at ...".
- Edit keeps one campus. Administrators get no Campus field; their profile `campus_id` is used.
- Completing through the Edit drawer also sets `ended_at` to now when empty and sets or clears `completer`. Reopening clears `completed_by`.
- `getOngoingEvents` and `getEvent` do not filter by role. The details page hides other campuses' events from Administrators on the client only.
- Deleting an event deletes all its field reports. The dialog warns with the count.
- The Complete dialog lists clusters that have not reported yet (from `useSummary`). Once Completed, ERT Members cannot send or edit reports for it.
- `summary.ts` reads casualty and damage severity from condition wording with regexes. Renaming a condition in Settings can change its colour and rank.
- `getEventSummarySource` is shared by campus details, event details, the print report and the NSED report. Changing its `select` affects all four.
- The NSED report's fixed wording lives in the template, not the code: edit `public/templates/nsed-report.docx` in Word and keep the `{…}` tags. The headcount-by-category table is raw XML from `nsed-docx.ts` (`{@categoryTable}`), because its columns are the clusters. `public/templates/` is left out of the service worker's precache (`publicExcludes` in `next.config.ts`).
- The NSED report lists clusters Pedro Gil, Padre Faura, Taft, PGH (the office's order), then others by name; a cluster made of numbered zones is listed by zone.

## Decisions

- [[0001-server-actions-only]]: all event reads and writes go through `src/actions/events`.
- [[0002-manual-sql-schema-changes]]: `completed_by` was added by `DRRM-011-super-admin-v2.sql`.
- [[0008-hand-built-charts]]: the event summary charts are hand-built.
