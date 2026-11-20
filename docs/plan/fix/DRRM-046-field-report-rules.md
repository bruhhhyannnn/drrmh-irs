---
type: fix
ticket: DRRM-046
status: done
branch: fix/DRRM-046-field-report-rules
modules:
  - '[[field-reports]]'
  - '[[events]]'
tags: [plan, fix, security]
---

# [DRRM-046] Fix Plan: Field report rules on the server

- **Status:** `[Done]`
- **Related Bugs / Audits:** GitHub #87, #101 (report part), #108 (items 4 and 5), #111
- **Target Branch / PR:** `fix/DRRM-046-field-report-rules`
- **Author:** Bryan Mangapit

---

## 1. Objective & Scope

The field report actions already checked who is writing (PR #90), but trusted where the report
goes and what it carries:

- `createReport` spread the payload into Prisma without parsing it. Extra keys reached the
  database, nested casualty and missing-person rows could carry `bystander_report_id` or `id`, and
  `report_casualties: { length: 4294967295 }` reached `groupReportPhotos` before any check (#101).
- A member could file into another campus's event, a completed event, or the same event many
  times; a typed unit could be added to any campus's cluster (#87, #101, #108 item 4).
- Members could still change reports, casualties and missing persons after the event ended
  (#108 item 5).
- `getReports`, `getMyReportForOngoingEvent(userId)`, `getMyLatestReport(userId)` and
  `getReportMissingPersons(reportId)` had no caller check (#87, also listed in #102).
- A control character in a name or unit name made the NSED export fail for the whole event (#111).

Non-goals: the event, bystander, campus, settings and dashboard actions (DRRM-047).

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [x] `src/lib/schemas.ts`: `withoutControlChars`; report and bystander free text is trimmed,
      capped and stripped of control characters (tab, LF and CR stay). Report lists are capped at
      `REPORT_LIST_MAX` (100), ages at 150, coordinates to valid ranges, `unit_id` must be a uuid.
      New `reportCreateSchema` (report + `id`, `user_id`, `sent_at`): unknown keys are dropped
      rather than refused, so a report queued by an older app version still sends.
- [x] `src/lib/report-caller.ts`:
  - `checkReportCaller` takes `event_open`: an admin whose scope covers the report may always
    write; the owner only while the event is ongoing.
  - `checkNewReport(profile, target)`: event on the caller's campus (admins: in scope), cluster on
    the event's campus, picked unit in the cluster; members only on an ongoing event, or for a
    report sent before the event ended (`sent_at` ≤ `ended_at`, the offline queue), and once per
    event. Admins in scope may add more, on any event.
- [x] `src/actions/reports/index.ts`:
  - `createReport` parses first, then `checkNewReport`, then uploads; the create runs in a
    transaction that locks the member's `users` row and counts their reports on the event again,
    so concurrent sends can't both land. Nested rows are built from named fields.
  - `saveReportEdits` checks the cluster against the event's campus and the unit against the
    cluster; `reportOwner` returns `event_open`, so edits and the casualty / missing-person writes
    refuse a member once the event has ended. Reads (`getReport`, `getReportCasualties`,
    `getReportMissingPersons`) stay open to the owner after the event.
  - `getReports(token, …)`: `requireAdmin`, campus from the verified scope.
  - `getMyReportForOngoingEvent(token)`, `getMyLatestReport(token)`: the user from the token.
  - `getReportMissingPersons(token, reportId)`: owner or in-scope admin.
  - Ids from the client are checked with `isUuid` before they reach a `where`.
- [x] `src/app/(admin)/_lib/nsed-docx.ts`: `stripInvalidXMLChars: true` on both templates, and
      `escapeXml` drops control characters for the raw table and chart XML.

### 2.2 Frontend / Components

- [x] `src/components/hooks/use-reports.ts`: `useReports`, `useMyReport`, `useMyLatestReport` and
      `useReportMissingPersons` pass the access token; query keys are unchanged.

### 2.3 Database / Prisma

- None. One report per member per event is enforced in the action (row lock + count), not by a
  unique index, because admins may file several and older data may already hold duplicates.

---

## 3. Verification

- [x] `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`
- [x] Tests: `report-caller.test.ts` (event lock; campus, cluster and unit checks; one report per
      event; offline report sent before the end), `nsed-report.test.ts` (`escapeXml` and a filled
      template with `\u0001` / `\u000b` in a unit, missing person and casualty).
- [ ] Manual: ERT report on an ongoing event (online and queued offline), a second report for the
      same event is refused; the submitted report can't be edited after Complete event; admin
      Reports list per campus, view, edit, delete, Add report; NSED export.
