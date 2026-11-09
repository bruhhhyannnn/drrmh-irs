---
type: feature
ticket: DRRM-028
status: in-review
branch: feat/DRRM-028-nsed-report-v2
modules:
  - '[[events]]'
tags: [plan, feature]
---

# [DRRM-028] Feature Plan: NSED report v2 (chart, unit breakdowns, office sections)

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-028-nsed-report-v2`
- **Owner / Author:** Bryan Mangapit

---

## 1. Problem Statement & Motivation

The NSED report export (DRRM-019) fills the UP Manila office's Word template, but it doesn't match the office's official report:

- The opening paragraph was written by the app, but the executive summary differs every quarter.
- The breakdown tables listed each report (unit, sender, time). The office's tables total each unit by personnel category.
- The headcount by category was a table. The office draws it as a stacked bar chart.
- Sections the office fills in were missing: the observers' comments, and the comparison of what reached the Incident Commander with what was sent through the IRS.
- The tables used 10 pt text, and names typed in capitals came out in capitals.

**Users:** the UP Manila DRRM-H office (UP Manila Administrators and Super Admins export it).

---

## 2. Requirements & User Stories

- **As the DRRM-H office**, I want the exported report to follow our official report's structure, so we only fill in what the app can't know.
- Acceptance criteria:
  - [x] Executive Summary heading (bold, body font and size) with a `[Add the executive summary]` blank in place of the written paragraph.
  - [x] Timeline of Reports: College/Building and Time centred.
  - [x] Under "Observations in Various Specific Areas of UP Manila and PGH": an Observer Name | Area/ Building | Comment/s table with five rows of `[…]` blanks.
  - [x] Summary of Headcount Report: a Structural damage column (where damage was reported, with its condition) and a total.
  - [x] Each breakdown: `College/Unit (<cluster>)` and one column per personnel category (short names: Faculty, Admin, REPS, RA, Students, Philcare, Security, Construction W., Tenants, Health W., Non-academic staff, Visitors/Patients), then Missing and Casualty; one row per unit (all its reports added up) and a Total row.
  - [x] Names in the notes written with a capital first letter (`JUAN DELA CRUZ` → `Juan Dela Cruz`).
  - [x] Table text 12 pt.
  - [x] Headcount by category as a chart like the office's (`image.png` at the time): stacked horizontal bars, one per unit, a colour per category plus Missing and Casualty, the total at the end of each bar, legend on the right.
  - [x] After the headcount-by-category analysis: the IC vs IRS section (intro, caption, Cluster | Total Headcount / Missing / Casualty reported to IC and via IRS, analysis blank). The IRS columns are filled; the IC columns are `[…]` blanks.

---

## 3. Architecture & Technical Design

### Data

- No schema change. `buildNsedReport` ([src/app/(admin)/\_lib/nsed-report.ts](<../../../src/app/(admin)/_lib/nsed-report.ts>)) now returns `clusters[].damage` and `totalDamage`, `breakdowns[].table` (`unitHeader`, `columns`, `rows`, `totals`) and `chart` (`units`, `series` with colours, `totals`). `standDownTime` and `categories` are gone.
- Units: a cluster's reports grouped by `unit_id`; PGH zones by zone number, other units in the order they first reported. Categories: the campus's fields in their order, then any field a report counted that is no longer active. Short names and colours come from `FIELD_STYLES` (matched by name); an unknown field keeps its name and takes a spare colour.

### The Word file

- [src/app/(admin)/\_lib/nsed-docx.ts](<../../../src/app/(admin)/_lib/nsed-docx.ts>):
  - `breakdownTableXml`: the per-unit table as raw XML (`{@tableXml}` inside `{#breakdowns}`), since its columns depend on the campus's fields. Category names run bottom to top so the number columns stay narrow; each column is as wide as its longest number.
  - `categoryChartXml`: a native Word chart (`word/charts/chart1.xml`, `c:barChart` with `barDir="bar"`, `grouping="stacked"`), values stored in the chart (no embedded workbook), so the office can restyle it in Word. The totals are labels on a last, invisible series whose legend entry is deleted. `fillNsedTemplate` adds the part, its relationship and content type, and drops folder entries (docxtemplater adds `word/`; Word Online and OneDrive fail on those).
- [public/templates/nsed-report.docx](../../../public/templates/nsed-report.docx): edited as XML (executive summary, centred timeline columns, observers table, damage column, `{@tableXml}`, `{@categoryChart}`, the IC vs IRS section, `NsedTableText` at 12 pt).

---

## 4. Implementation Tasks

- [x] Report data: damage, unit breakdowns, chart data, `properName`
- [x] Breakdown table and chart XML, chart part, no folder entries
- [x] Template edits
- [x] Tests

---

## 5. Verification & Rollout Plan

- [x] `npm run test`: breakdown tables, one row per unit, damage, names, chart data and XML, the template fills with no leftover tags (chart part, relationship, content type, no folder entries, 12 pt tables), and an event with no reports.
- [x] A sample report with all 12 UP Manila fields passes the docx skill's OOXML validation, including the chart part against `dml-chart.xsd`.
- [x] `npm run lint`, `npm run type-check`, `npm run build`.
- [ ] Open an exported report in Word and compare the chart and the breakdown tables with the office's report. Word automation isn't available here, so the layout was checked from the XML only.
