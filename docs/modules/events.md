---
type: module
updated: 2026-11-10
module: events
paths:
  - src/actions/events/index.ts
  - src/components/hooks/use-events.ts
  - src/app/(admin)/events
  - src/app/(admin)/_lib/summary.ts
  - src/app/(admin)/_lib/status.ts
  - src/app/(admin)/_lib/nsed-report.ts
  - src/app/(admin)/_lib/headcount-chart.ts
  - src/app/(admin)/_lib/nsed-docx.ts
  - src/app/(admin)/_lib/nsed-diliman.ts
  - public/templates/nsed-report.docx
  - public/templates/nsed-report-diliman.docx
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
| `src/app/(admin)/_lib/summary.ts`                            | Pure event summary model: `buildSummary`, `compareSummaries`, `reportTimeline` |
| `src/app/(admin)/_lib/status.ts`                             | `eventStatusKey`, `eventTone`                                                  |
| `src/app/(admin)/_lib/nsed-report.ts`                        | `buildNsedReport`: the NSED report's fields from the summary source (tested)   |
| `src/app/(admin)/_lib/nsed-docx.ts`                          | `fillNsedTemplate`, `downloadNsedReport`: docxtemplater fill and download      |
| `public/templates/nsed-report.docx`                          | The UP Manila office's NSED report template (letterhead, wording, tags)        |
| `src/app/(admin)/_lib/nsed-diliman.ts`                       | `buildNsedDilimanReport`: UPRI's UP Diliman NSED report fields (tested)        |
| `public/templates/nsed-report-diliman.docx`                  | UPRI's UP Diliman NSED report template (letterhead, wording, tags)             |
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
- `deleteEvent(id)`: deletes the event; its reports go with it (cascade), and their photos are deleted from Storage after it ([[field-reports]]). One interactive transaction locks the event and its reports (`SELECT ... FOR UPDATE`), reads their photo paths and deletes the event, so a report or casualty added meanwhile waits instead of leaving photos behind. The photos are removed after commit, in chunks of 1000 paths.
- `getOngoingEvents(campusId)`: ongoing events at one campus (ERT `/home` and `/report`).
- `getOngoingEventOptions(campusId?)`: ongoing events for the admin Add report drawer.
- `getSiblingOngoingEvents(eventId)`: same-name ongoing events at other campuses.
- `getCampusEventOptions(campusId)`: all events at a campus, for "Compare with".
- `getEventSummarySource(eventId)`: event, its reports (people, damage, headcount), active clusters with their active units, and active population fields.

Every mutation calls `revalidatePath` on `/events`, `/events/details` and `/dashboard`.

## Client side

- Routes: `/events` (tabs All / Ongoing / Upcoming / Completed), `/events/details?id=`, and `/events?add=1` (opens Add event, used by the dashboard).
- Hooks: `useEvents`, `useEvent`, `useCreateEvents`, `useUpdateEvent`, `useCompleteEvents`, `useDeleteEvent`, `useOngoingEvents` (optional `refetchInterval`), `useOngoingEventOptions`, `useSiblingOngoingEvents`, `useCampusEventOptions`, `useEventSummarySource`.
- Mutations invalidate `events`, `event`, `event-summary`, `event-siblings`, `event-compare-options`, `dashboard`, `campus-overview`, `campuses-overview`.
- Form: `eventSchema` in `src/lib/schemas.ts` (`campus_ids` array, end must be after start).
- Campus scope comes from `useScopedCampusId()` and `useIsSuperAdmin()` in `(admin)/_components/shell/campus-switcher.tsx`. `useEventTitle()` shows "Name — Campus" to Super Admins only.
- Export PDF (event details, and the download icon on each `/events` row and phone card) opens `/events/report?id=` in a new tab (see [[print]]). The Excel export was removed in DRRM-018.
- Export NSED report (event details only, when the event is completed and `nsedTemplateFor(campus)` names a template: UP Manila and PGH get the UP Manila DRRM-H office's report, UP Diliman gets UPRI's, other campuses none): the campus's quarterly NSED report as a Word file. UP Manila and PGH: `downloadNsedReport` is imported on click, fetches `public/templates/nsed-report.docx`, fills it with `buildNsedReport(source)` through docxtemplater + pizzip and saves `NSED Report Q1 2026.docx`. The app fills what it records (date and times, headcount per cluster, the timeline, the headcount summary with structural damage, one breakdown table and note per cluster, the headcount-by-category chart, the IRS side of the IC vs IRS table); the rest are yellow `[Add …]` and `[…]` blanks for the office (the executive summary, the observers' comments, the IC figures, the analyses). Tags and rules: [[plan/feature/DRRM-019-nsed-report]], changes in [[plan/feature/DRRM-028-nsed-report-v2]].
- UP Diliman's NSED report (DRRM-032): `buildNsedDilimanReport(source)` fills `public/templates/nsed-report-diliman.docx`, UPRI's report (without the cover letter to the UP President that UPRI sends with it), saved as `NSED-2026-Q4-UP-Diliman-report.docx`. The app fills the drill date, quarter and start time, the counts in the executive summary (reports, clusters that reported out of the campus's clusters, individuals, people by category, casualties by condition, minutes to the first and last report) and the cluster table (`{@clusterTable}`: No. | Cluster | College/Unit | Reports | Casualties | Headcount, a Cluster Total row per cluster with its units under it, first report first, and a GRAND TOTAL). The report's date, the signatories, the observations, the comparison with the previous quarter, the screenshots and the assessment are yellow `[Add …]` blanks for UPRI. Tags: [[plan/feature/DRRM-032-nsed-report-pgh-diliman]].
- Timeline of reports (`TimelineCard`, DRRM-030): who reported, from which college or building, and when, first report first, on the event summary after Clusters (or Units) and before Headcount. It uses `reportTimeline` and `reportPlace` from `summary.ts`, which the NSED report's timeline uses too, follows the cluster drill-down, and is left out on a unit's page (`UnitReportsCard` lists those reports).
- Headcount (`HeadcountCard`, DRRM-031): the NSED report's headcount-by-category chart, a stacked bar per unit that reported (grouped by cluster, first 10 then Show all) with a colour per category, then Missing and Casualty, and the total at each bar's end; the legend gives each category's total. Both are built by `headcountChart(source)` in `headcount-chart.ts`, so the card and the Word chart agree. It follows the cluster drill-down. The per-field `summary.headcount.rows` stays for the print report.
- Drill-down (`_components/summary/drill-down.tsx`, DRRM-024): clicking a cluster or unit narrows the whole summary. The scope lives in the link (`&cluster=<id>&unit=<id or none>`). `resolveScope` validates it (a bad link shows the whole event with a note), `scopeSource` filters the source, and `buildSummary` runs on the result, so every section agrees. Compare and exports always stay whole-event, and the Completed banner reads the full summary. On a unit's page, reports open in `ReportDrawer`, read-only once the event is completed. On `/campus/details`, the picked event is the `event` param, because `id` is the campus there.
- Units with no report yet: `getEventSummarySource` loads each active cluster's active units, and `buildSummary` adds a `coverage` to each cluster (`4 of 6 units`, and the missing names). Reports with no unit or a deactivated unit stay in the numbers but not in coverage. On a completed event, a unit created after `ended_at` isn't expected.
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
- The NSED reports' fixed wording lives in the templates, not the code: edit `public/templates/nsed-report.docx` (UP Manila, PGH) or `nsed-report-diliman.docx` (UP Diliman) in Word and keep the `{…}` tags. A new campus needs a template and a line in `nsedTemplateFor`; templates are not uploaded from the app. Two parts are built in code, because their shape depends on the data: each breakdown table (`{@tableXml}`, a row per unit and a column per personnel category; it runs into the side margins, to 0.25 in from the paper's edges, so its headers fit left to right at 8 pt, see `breakdownLayout`) and the headcount-by-category chart (`{@categoryChart}`, a native Word chart added as `word/charts/chart1.xml`, values stored in the chart, the totals drawn as labels on a hidden last series). The short category names and chart colours are `FIELD_STYLES` in `headcount-chart.ts` (shared with the summary's Headcount card), matched by name; a new field keeps its full name and takes a spare colour. `public/templates/` is left out of the service worker's precache (`publicExcludes` in `next.config.ts`).
- The NSED report lists clusters Pedro Gil, Padre Faura, Taft, PGH (the office's order), then others by name. Within a cluster, units are listed in the order they first reported, and a cluster made of numbered zones is listed by zone. Two reports from one unit add up to one row.

## Decisions

- [[0001-server-actions-only]]: all event reads and writes go through `src/actions/events`.
- [[0002-manual-sql-schema-changes]]: `completed_by` was added by `DRRM-011-super-admin-v2.sql`.
- [[0008-hand-built-charts]]: the event summary charts are hand-built.
