---
type: feature
ticket: DRRM-019
status: in-review
branch: feat/DRRM-019-nsed-report
modules:
  - '[[events]]'
  - '[[field-reports]]'
  - '[[offline-pwa]]'
  - '[[print]]'
tags: [plan, feature]
---

# [DRRM-019] Feature Plan: Export NSED report (.docx, UP Manila only)

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-019-nsed-report` → `dev` (branched from `feat/DRRM-018-design-review-fixes`, so merge DRRM-018 first)
- **Owner / Author:** Bryan Mangapit
- **Design source:** Claude Design project → `IRS - Super Admin.dc.html`, turn 7 ("NSED report for the office") and 7a (the 9-page Word file); SA8c and AD5c for the button. Item 10 of `CHANGES for Claude Code.md`.

---

## 1. Problem Statement & Motivation

After each quarterly drill, the UP Manila DRRM-H office writes an NSED overall summary report on its letterhead: an introduction, a timeline of reports, findings and recommendations, the headcount by cluster and category, and signatures. Until now they copied the figures out of the app by hand (or pasted screenshots of spreadsheets). The app already has every report, so it should fill in what it records and leave the rest for the office to write in Word.

---

## 2. Requirements & User Stories

- **As a UP Manila admin or a Super Admin**, I want one click on a completed UP Manila event to download the NSED report as a Word file, already filled with the figures from the reports, so I only write the parts the app can't know.
- **As the DRRM-H office**, I want to change the report's fixed wording in Word, without a code change.

Acceptance criteria:

- [x] Event details: **Export NSED report** (outline button, file icon) sits next to Export PDF, only when the event is completed and its campus is UP Manila. Export PDF is unchanged on every campus.
- [x] One click, no form. The .docx is built in the browser with docxtemplater + pizzip and downloads as `NSED Report Q1 2026.docx`.
- [x] The template is the office's `template.docx` (letterhead header and footer) with the report's wording and docxtemplater tags added, in `public/templates/nsed-report.docx`.
- [x] Filled from data: quarter ordinal and year, drill date with weekday and start time, stand-down time (when the event was completed), headcount per cluster (Pedro Gil, Padre Faura, Taft, PGH) and the total, first report time, the Timeline of Reports table, the Summary of Headcount table with a total row, one breakdown table per cluster with "Total (cluster): N", a note per cluster (missing persons by name and unit or a count when unnamed, casualties by condition, building damage), and headcount by category × cluster with totals.
- [x] Left as yellow-highlighted `[Add …]` blanks (the highlight survives in Word): Incident Commander, observers, CPDMO assessment, stand down, acknowledgements, the 11 Findings and Recommendations headings (Good Points / Points for Improvement), the analyses, extra cluster notes, observer timetable rows, documentation photos, signatories.
- [x] Report time is when the report was sent on the device: an offline report keeps its queue time.
- [x] Long tables repeat their header row on each page (`w:tblHeader`); tables are text, not images.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

No schema change. `Report.submitted_at` now holds the device's send time for reports replayed from the offline queue (it defaulted to the server's `now()` before).

### Server Actions & Data Flow

- `createReport` (`src/actions/reports`) takes an optional `sent_at` (ms). `OfflineQueueProvider` passes the queued entry's `createdAt` for field reports; `flushOne` now hands `submit` the entry as a third argument. The time is capped at now; online sends leave it unset, so the database default applies.
- The report reads the same `getEventSummarySource(eventId)` as the event summary and the PDF, through `useEventSummarySource` (already cached on event details). No new action.

### Client

- `src/app/(admin)/_lib/nsed-report.ts`: `buildNsedReport(source)` turns the summary source into the template's fields (pure, tested). Also `isUpManila`, `quarterOf`, `nsedFileName`.
- `src/app/(admin)/_lib/nsed-docx.ts`: `fillNsedTemplate(template, data)` runs docxtemplater (`paragraphLoop`, `linebreaks`, empty `nullGetter`); `downloadNsedReport(source)` fetches the template, fills it and saves the file. Event details loads it with `import()` on click, so docxtemplater isn't in the page bundle.
- The category table is the only table whose columns depend on the data (one per cluster). docxtemplater's free core can't repeat columns, so it goes in as raw XML (`{@categoryTable}`), drawn like the template's tables.
- `next.config.ts`: `publicExcludes` keeps `public/templates/` out of the service worker's precache, so ERT phones don't download it.

### Rules worth knowing

- Clusters are listed Pedro Gil, Padre Faura, Taft, PGH (the office's order), then any other cluster by name. Clusters with no report still get a row and a breakdown ("No reports were received from this cluster.").
- Breakdown rows are in time order, except a cluster whose units are all numbered zones (PGH), which is listed by zone.
- "PGH Zone 1" in the timeline: zone units are prefixed with their cluster; a report without a unit shows "<cluster> cluster".
- Condition names from Settings are shortened to the part before " — " ("Minor injuries — no hospitalization needed" → "minor injuries"), with counts in brackets, so any wording reads correctly.
- Breakdown titles add "Cluster" except for acronyms ("PGH") and names already ending in "cluster".

### Template tags

`{quarterOrdinalUpper}` `{quarterOrdinal}` `{year}` `{drillDate}` `{drillWeekday}` `{startTime}` `{standDownTime}` `{clusterHeadcounts}` `{totalHeadcount}` `{firstReportTime}`; tables `{#timeline}{name} {place} {time}{/timeline}`, `{#clusters}{name} {units} {headcount} {missing} {casualties}{/clusters}` with `{totalUnits}` `{totalMissing}` `{totalCasualties}`; per cluster `{#breakdowns}` … `{title}` `{#hasReports}` `{#rows}{unit} {reportedBy} {time} {headcount} {missing} {casualties}{/rows}` `{/hasReports}` `{^hasReports}` … `{/hasReports}` `{headcount}` `{note}` … `{/breakdowns}`; and `{@categoryTable}` (alone in its paragraph). The office can move or reword everything around them in Word.

---

## 4. Implementation Tasks

- [x] Template: body added to the office's `template.docx` (Arial 12 body, Arial 10 tables, `NSED …` paragraph styles, bullet list for findings), header and footer untouched; validated against the OOXML schemas.
- [x] `nsed-report.ts` + tests; `nsed-docx.ts` + a test that fills the real template.
- [x] Export NSED report button on event details (shared by Super Admin and Admin).
- [x] Offline report time (`sent_at`).
- [x] `publicExcludes` for the template.

---

## 5. Verification & Rollout Plan

- [x] `npm run test` (7 new tests: data, quarter, notes, category table, the template fills with no leftover tags, header rows repeat), `npm run lint`, `npm run type-check`, `npm run build`.
- [x] The filled sample (design's Q1 2026 figures) passes the OOXML schema validator.
- [ ] Open a downloaded report in Word and check the page layout against 7a (fonts, page breaks, the letterhead spacing). Word automation wasn't available while building this, so the layout was checked from the XML only.
- [ ] After merge: confirm an offline-queued report shows its send time in the timeline.
