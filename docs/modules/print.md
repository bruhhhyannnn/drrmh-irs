---
type: module
updated: 2026-10-27
module: print
paths:
  - src/app/(print)
  - src/components/print/report-sheet.tsx
  - src/app/(ert)/assessment/_components/assessment-print.tsx
tags: [module]
---

# Print reports (A4)

Pages laid out as A4 sheets and saved as PDF from the browser's print dialog. Administrators and Super Admins print the event report and a submitted building assessment. ERT Members print their own assessments from `/assessment?print=<id>`. All of them share one A4 frame in `src/components/print/report-sheet.tsx`.

**Related:** [[architecture]] · [[events]] · [[assessments]] · [[assessment-admin]] · [[design-system]] · [[auth]]

## Where it lives

| Path                                                        | What it holds                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/app/(print)/layout.tsx`                                | Wraps every print page in `ProtectedRoute`; no admin shell                                                   |
| `src/app/(print)/events/report/page.tsx`                    | `/events/report?id=<event id>`: the event report                                                             |
| `src/app/(print)/assessments/report/page.tsx`               | `/assessments/report?id=<assessment id>`: one assessment for admins, rendered with `RecordPrint`             |
| `src/components/print/report-sheet.tsx`                     | The A4 frame: `PrintPageStyle`, `PrintShell`, `PrintToolbar`, `Sheet`, `Letterhead`, `Section`               |
| `src/app/(ert)/assessment/_components/assessment-print.tsx` | `AssessmentPrint` (ERT, `?print=<id>`) and `RecordPrint` (the assessment pages, shared with the admin route) |
| `src/app/(ert)/assessment/page.tsx`                         | Returns `<AssessmentPrint>` when the `print` param is set, before the ERT frame                              |
| `src/app/(admin)/_components/summary/charts.tsx`            | Summary charts (`ColumnChart`, `RankedBars`, `Donut`, `DamageChart`, `SERIES`) reused in the event report    |
| `src/app/(admin)/_lib/summary.ts`                           | Event summary model (`compareSummaries`, `timelineOf`, `firstReportScale`, `shortLabel`)                     |

## Data

Reads only. No writes.

- Event report: `Event` (`events`) with its `campus` and `status`, plus the reports, casualties, missing persons and population counts that `getEventSummarySource` loads (see [[events]]). The previous drill comes from `getCampusEventOptions(campusId)`.
- Assessment print: an `AssessmentRecord` (from `src/lib/assessment-records.ts`) built over `Assessment` (`assessments`), its template version, answers, areas and pillar scores.

## Server actions

None of its own. It calls:

- `getEventSummarySource(eventId)` and `getCampusEventOptions(campusId)` in `src/actions/events`, via `useEventSummarySource` and `useCampusEventOptions` (`use-events.ts`). Neither checks the caller; the event report page does the campus check itself (below).
- `getAssessment(token, id)` in `src/actions/assessment-admin`, via `useAdminAssessment`. It calls `requireAdmin(token)` and returns `null` when the record is outside the caller's campus scope.
- `getMyAssessment(token, id)` in `src/actions/assessments`, via `useMyAssessment`. It calls `requireProfile(token)` and only loads the caller's own assessment (`evaluator_id`).

## Client side

- Routes: `/events/report?id=`, `/assessments/report?id=`, `/assessment?print=<id>`.
- Opened in a new tab: event details (`/events/details`) calls `window.open('/events/report?id=…')`; admin assessment details (`/assessments/details`) opens `/assessments/report?id=…`. The ERT read-only view (`assessment-view.tsx`) navigates to `?print=<id>`.
- `PrintShell` sets `data-print-report` and `data-theme="light"` and the Figtree / Spline Sans Mono font variables. Its toolbar is hidden in print.
- `PrintToolbar` has a back link and a button that calls `window.print()` ("Save as PDF" on the event report, "Print" on assessments).
- `PrintPageStyle` writes the `@page` rules: A4, margins `16mm 15mm 14mm`, title and running header from page 2 (`@page :first` clears them), generated line bottom-left and "Page x of y" bottom-right.
- `Sheet` is one A4 page on screen; in print its content flows and the next sheet starts a new page (`print:break-after-page` unless `last`). It repeats the header and generated line on screen only.
- `Letterhead` shows the campus logo from `ownCampusLogo(campus)` (fallback `/up-logo.png`) and `/irs-logo.png`.
- Event report sheets: summary and comparison with the previous drill at the same campus; clusters and headcount; casualties and missing persons; analytics charts and signature lines (Prepared by, Noted by).
- Assessment sheets (`RecordPrint`): details and scores, action list, every answer, and signatures. It rescores the record on the client with `scoreAssessment` and `applicableItems`.

## Rules and gotchas

- The report is white with dark text whatever the app theme: `PrintShell` is a `data-theme="light"` subtree, and `PrintPageStyle` sets `color-scheme: light` on `<html>` (scrollbar, print) and a white page in print.
- Both report pages open the print dialog by themselves once data is ready, after `document.fonts.ready` plus 400 ms, and only once (`printed` ref). `RecordPrint` cancels it if the page is left first.
- `document.title` is set before printing because it becomes the saved PDF's file name. `RecordPrint` restores the old title on unmount.
- The `(print)` layout uses `ProtectedRoute`, which sends ERT Members and Bystanders to `/home`, so `/events/report` and `/assessments/report` are admin-only.
- The event report's campus check is client-side: an Administrator gets the "no longer exists" message when `source.event.campus_id` is not their `campus_id`. `getEventSummarySource` itself does not check scope.
- `/assessment?print=` stays in the `(ert)` route group and is returned before `ErtFrame`, so it keeps the ERT access guard but has no app chrome. It is a query param, not a segment, so the service worker can cache it. It still needs a connection: offline it shows "You're offline. Connect to print this assessment."
- Checklist text prints in both languages: `RecordPrint` passes `language="both"` to `<Bilingual>`, ignoring the device's checklist language.
- Pages stay light in dark mode because of `data-theme="light"` on `PrintShell` (the `dark` variant in `globals.css` skips that subtree).
- `print:` styles plus `print-color-adjust: exact` keep the coloured chips and bars on paper. Use `break-inside-avoid` on rows and boxes that must not split.
- Charts inside the report use the `print-report` custom variant (`[data-print-report] *`) for their print sizes.
- The running header and page numbers use `@page` margin boxes, which Chrome supports; other browsers may leave them out.

## Decisions

- [[0005-assessment-single-route]]: the ERT print view is `?print=<id>` on `/assessment`, not its own segment.
- [[0007-token-verified-actions]]: assessment prints load through token-verified actions (`requireProfile`, `requireAdmin`).
- [[0008-hand-built-charts]]: the event report reuses the hand-built summary charts.
- [[0001-server-actions-only]]: print pages read through server actions and TanStack Query hooks.
