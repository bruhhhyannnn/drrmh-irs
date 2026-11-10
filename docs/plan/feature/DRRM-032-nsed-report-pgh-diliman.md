---
type: feature
ticket: DRRM-032
status: in-review
branch: feat/DRRM-032-nsed-report-pgh-diliman
modules:
  - '[[events]]'
tags: [plan, feature]
---

# [DRRM-032] Feature Plan: NSED report for PGH and UP Diliman

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-032-nsed-report-pgh-diliman`
- **Owner / Author:** Bryan Mangapit

---

## 1. Problem Statement & Motivation

Export NSED report (DRRM-019, DRRM-028) only shows for UP Manila events. Two more campuses need it:

- **PGH** is covered by the UP Manila DRRM-H office, whose report already reads "Observations in Various Specific Areas of UP Manila and PGH". PGH events get the same template.
- **UP Diliman**: the UP Resilience Institute (UPRI) writes its own NSED report for UP Diliman: a title page, signatories, an executive summary and a table of the clusters and units that reported. UPRI shared its Q4 2026 report as the model. Its first page, a cover letter to the UP President, is not part of the report and is left out.

Templates stay in `public/templates/`, picked by campus in code. Uploading templates from Settings (a table and a mutation) is not needed while there are two offices with fixed formats; it can come later if offices start changing their wording themselves.

**Users:** Administrators and Super Admins of UP Manila, PGH and UP Diliman, after a drill is completed.

---

## 2. Requirements & User Stories

- **As a PGH admin**, I want Export NSED report on a completed event, filled the same way as UP Manila's.
- **As a UP Diliman admin**, I want Export NSED report to give UPRI's report with the IRS's counts filled in, so UPRI only writes what the IRS can't know.
- Acceptance criteria:
  - [x] `nsedTemplateFor(campusName)`: "UP Manila" and "PGH" → the UP Manila template, "UP Diliman" → the UP Diliman template, any other campus → no button.
  - [x] UP Diliman template made from UPRI's report: letterhead, header and footer, and fixed wording kept. The cover letter (page 1) is removed. Everything that changes each NSED is a yellow `[Add …]` blank: the report's date, the signatories (UPRI's names and the signature image are removed), the staff who prepared it, the observations, the comparison with the previous quarter, the overall assessment, the link to the event report PDF. The two app screenshots become `[Insert a screenshot …]` blanks.
  - [x] Filled from the IRS: the drill date, quarter and start time; reports received, clusters that reported out of the campus's clusters, individuals counted; people by category; casualties by condition; minutes to the first and last report.
  - [x] The table: a header row (No. | Cluster | College/Unit | Reports | Casualties | Headcount) that repeats on each page, then per cluster a bold "Cluster Total" row and its units (No. and Cluster merged down), in the order they first reported, then GRAND TOTAL. Reports with no unit read "No unit specified".
  - [x] Saved as `NSED-2026-Q4-UP-Diliman-report.docx`, as UPRI names it. UP Manila and PGH keep `NSED Report Q4 2026.docx`.
  - [x] UP Manila's report is unchanged.

Not in scope: the comparison with the previous quarter (needs the previous event's reports; a blank for now), other campuses.

---

## 3. Technical Design

- [src/app/(admin)/\_lib/nsed-report.ts](<../../../src/app/(admin)/_lib/nsed-report.ts>): `nsedTemplateFor` replaces `isUpManila`; `ORDINALS`, `WORDS`, `num`, `list`, `shortCondition` exported for the Diliman report.
- [src/app/(admin)/\_lib/nsed-diliman.ts](<../../../src/app/(admin)/_lib/nsed-diliman.ts>) (new, pure): `buildNsedDilimanReport(source)`, `clusterTableOf(reports)`, `nsedDilimanFileName(source)`. Units come from `unitsOf` in `headcount-chart.ts`.
- [src/app/(admin)/\_lib/nsed-docx.ts](<../../../src/app/(admin)/_lib/nsed-docx.ts>): `clusterTableXml` (raw XML, `{@clusterTable}`), `fillNsedDilimanTemplate`; `downloadNsedReport` picks the template and file name by campus.
- [public/templates/nsed-report-diliman.docx](../../../public/templates/nsed-report-diliman.docx) (new): made from UPRI's report with a script that rewrote the paragraphs that change, removed the cover letter, the signature, the screenshots, the comments and the Drive link, and added the missing `gutter` on the page margins (Google Docs leaves it out). Edit it in Word and keep the `{…}` tags.
- [src/app/(admin)/events/details/page.tsx](<../../../src/app/(admin)/events/details/page.tsx>): the button shows when `nsedTemplateFor(campus)` is not null.
- `public/templates/` is already out of the service worker's precache.

### UP Diliman template tags

`{drillDate}` `{quarter}` `{quarterOrdinal}` `{year}` `{startTime}` `{reportCount}` `{reportVerb}` `{clusterCount}` `{individuals}` `{categoryCounts}` `{clustersReported}` `{clustersTotal}` `{#hasCasualties}` `{casualtyCount}` `{casualtyBreakdown}` `{/hasCasualties}` `{^hasCasualties}` `{#hasReports}` `{firstReportAfter}` `{lastReportAfter}` `{/hasReports}` `{@clusterTable}`

---

## 4. Verification

- [x] `npm run test`: which campus gets which template; the table (order, units, no unit, totals); the summary counts and singulars; the table XML (header, merges, grand total); the real template fills with no leftover tags, keeps its blanks highlighted and carries no names, signature or comments; an event with no reports.
- [x] A filled sample and the template pass the OOXML schema validation.
- [x] Opened in Word by the user.
- [x] `npm run lint`, `npm run type-check`, `npm run build`.
