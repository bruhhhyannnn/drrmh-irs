---
type: feature
ticket: DRRM-031
status: in-review
branch: feat/DRRM-031-headcount-by-unit-chart
modules:
  - '[[events]]'
tags: [plan, feature]
---

# [DRRM-031] Feature Plan: Headcount by category chart on the event summary

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-031-headcount-by-unit-chart`
- **Owner / Author:** Bryan Mangapit

---

## 1. Problem Statement & Motivation

The NSED report (DRRM-028) shows the headcount as a stacked bar chart: a bar per unit that reported, a colour per personnel category, then Missing and Casualty, with the total at each bar's end. The event summary's Headcount card showed something else: one bar per field over the whole event (or a picked cluster). The office wants the card to show the same chart as the report, so the screen and the Word file read the same way.

**Users:** Administrators and Super Admins, during a drill and afterwards.

---

## 2. Requirements & User Stories

- **As an admin**, I want the Headcount card to show each unit's headcount by category, like the NSED report, so I can see where people are and which units are light or carry missing persons and casualties.
- Acceptance criteria:
  - [x] The Headcount card is a stacked bar per unit that reported, grouped by cluster (cluster names shown when there is more than one), in the NSED report's cluster and unit order, with the report's short category names and colours.
  - [x] Each bar's total at its end: the categories plus missing persons and casualties, as in the report.
  - [x] A legend with each category's total over the units shown; categories at 0 are left out. The header keeps the people count.
  - [x] Follows the cluster drill-down (a cluster shows its units, a unit its one bar); the old "All clusters" picker is gone.
  - [x] First 10 units, then Show all; names over the bars on phones.
  - [x] The NSED report's chart is built from the same data, unchanged.

---

## 3. Technical Design

- [src/app/(admin)/\_lib/headcount-chart.ts](<../../../src/app/(admin)/_lib/headcount-chart.ts>) (new, pure): `FIELD_STYLES` and the cluster order moved from `nsed-report.ts`, with `orderedClusters`, `unitsOf`, `headcountColumns` and `headcountChart(source)` (`{ series: {name, color, total}[], clusters: {id, name, units: {key, name, values, total}[]}[] }`).
- [src/app/(admin)/\_lib/nsed-report.ts](<../../../src/app/(admin)/_lib/nsed-report.ts>): uses those; `chart` (the Word chart) is flattened from `headcountChart`, so the card and the report agree.
- [src/app/(admin)/\_components/summary/charts.tsx](<../../../src/app/(admin)/_components/summary/charts.tsx>): `StackedBars` (grouped rows: name | stacked bar | total; each row's values in its `aria-label`, each segment's on hover) and `StackedLegend`.
- [src/app/(admin)/\_components/summary/sections.tsx](<../../../src/app/(admin)/_components/summary/sections.tsx>): `HeadcountCard` rebuilt on those; `ShowAllFooter` takes an optional `first`.
- `summary.headcount.rows` (per field) stays: the print report (`/events/report`) still uses it.
- No new server action or query.

---

## 4. Verification

- [x] `npm run test`: the chart's clusters, units, values and totals, a cluster scope, an event with no reports; the NSED chart test unchanged.
- [x] Card checked on a preview page at 1100px (light, dark, Show all), 768px and 375px, for the whole event, a cluster, a unit and no reports: no overflow.
- [x] `npm run lint`, `npm run type-check`, `npm run build`.
- [x] Tested by the user on the real event pages before committing.
