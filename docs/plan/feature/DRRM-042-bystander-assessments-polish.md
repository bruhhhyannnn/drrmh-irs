---
type: feature
ticket: DRRM-042
status: done
branch: feat/DRRM-042-bystander-assessments-polish
modules:
  - '[[bystander-reports]]'
  - '[[assessment-admin]]'
tags: [plan, feature, design-round-2026-11-11]
---

# [DRRM-042] Feature Plan: Bystander reports and Assessments: small improvements (optional)

- **Status:** `[Done]`
- **Target Branch / PR:** `feat/DRRM-042-bystander-assessments-polish`
- **Owner / Author:** Bryan Mangapit
- **Depends on:** DRRM-033, DRRM-034

> Design source: the screenshots below are the whole design. Don't open the Claude Design canvas for this ticket; it also holds older turns (1–8) that are already built.
> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`. Afterwards update the module notes listed in `modules:` and add a line to `docs/changelog.md`.

---

## 1. Problem Statement & Motivation

Optional. Brings these two lists in line with the rest of this round.

---

## 2. Design

![SA52 bystander suggestions](../../design/2026-11-11-admin-polish/SA52-bystander-suggestions.png)

![SA53 assessments suggestions](../../design/2026-11-11-admin-polish/SA53-assessments-suggestions.png)

---

## 3. Requirements & Acceptance Criteria

**Bystander reports** (`src/app/(admin)/emergency-reports/page.tsx`)

- [x] The row opens the report (DRRM-033 row link). Remove View.
- [x] Campus column shows the campus logo.
- [x] Unopened reports:
  - A red dot.
  - Their age in red ("25 min ago") until someone opens them.
  - Relative age under 24h, then a date.
- [x] A camera icon with the photo count when the report has photos.

**Assessments** (`src/app/(admin)/assessments/_components/`)

- [x] Quick filter chips with counts above the Buildings table: Needs follow-up, Not yet assessed, Not assessed in 6 months.
- [x] Scores under 60% in red.
- [x] The row opens the building.
- [x] Edit checklist goes into ⋯ (DRRM-034).

---

## 4. Technical Design

- Unopened state needs a `seen_at` (or similar) on the bystander report, set when an admin opens it.

---

## 5. Implementation Tasks

- [x] Bystander changes
- [x] Assessments chips and row link
- [x] Update the two module notes

---

## Notes from the build

- **Apply `prisma/manual/DRRM-042-bystander-seen.sql`** (`bystander_reports.seen_at`, with reports already reviewed, verified or dismissed counted as opened). Safe to deploy first: `seen_at` is left out of default reads and read with a query that tolerates it missing, so nothing shows as unopened until it runs.
- Opened means opened by any admin, once; `markBystanderReportSeen` takes the caller's token (admins only).
- The bystander drawer opens from the row, so the row is a button (`onRowClick`); `RowButton` (Review / Verify) now sits above a row's stretched link, so Verify still asks to confirm instead of opening the report.
- "The building" is the Compare tab for that building (its assessments over time), as the design note says ("its assessments and Compare"); the latest assessment stays one tap away there and on the phone card.
- Edit checklist was already in the ⋯ menu (PR #112).
- Checked in a temporary preview with sample data: the bystander list (red dots and ages, logos, photo counts), a row click opens the drawer and clears its dot, Verify opens its confirm dialog; Assessments with `?filter=follow-up` (chip on, two rows, scores under 60% in red).

## 6. Out of Scope

- Anything else on these pages.
