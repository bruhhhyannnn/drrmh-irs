---
type: feature
ticket: DRRM-035
status: done
branch: feat/DRRM-035-campus-logos-events-reports
modules:
  - '[[events]]'
  - '[[field-reports]]'
tags: [plan, feature, design-round-2026-11-11]
---

# [DRRM-035] Feature Plan: Campus logos in Events and Reports, NSED in the Events row, campus backdrop on event details

- **Status:** `[Done]`
- **Target Branch / PR:** `feat/DRRM-035-campus-logos-events-reports`
- **Owner / Author:** Bryan Mangapit
- **Depends on:** DRRM-033 (row link and hover)

> Design source: the screenshots below are the whole design. Don't open the Claude Design canvas for this ticket; it also holds older turns (1–8) that are already built.
> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`. Afterwards update the module notes listed in `modules:` and add a line to `docs/changelog.md`.

---

## 1. Problem Statement & Motivation

With many "Q4 2026 NSED" events across campuses, the lists are hard to tell apart. The campus is plain text.

Event details doesn't show which campus it belongs to at a glance.

The Events row lacks the NSED export, and its View button duplicates clicking the row.

---

## 2. Design

![SA48 events list](../../design/2026-11-11-admin-polish/SA48-events-list.png)

![SA49 event details backdrop](../../design/2026-11-11-admin-polish/SA49-event-details-backdrop.png)

![SA50 reports list](../../design/2026-11-11-admin-polish/SA50-reports-list.png) (ignore the profile photos here: those come in DRRM-039; keep initials for now)

---

## 3. Requirements & Acceptance Criteria

**Events list** (`src/app/(admin)/events/page.tsx`)

- [x] Campus column: `CampusMark` (28px) before the name. Campuses without a logo show the UP seal (`campusLogo()`).
- [x] Row actions, in order:
  1. Export NSED report: a `FileText` icon with the tooltip "Export NSED report", only on completed events where `nsedTemplateFor(campus.name)`. Reuse `ExportNsedButton` as an icon variant. Otherwise keep an empty 36px slot so the icons line up.
  2. Export PDF
  3. Edit
  4. Delete
- [x] No View; the row opens the event (DRRM-033 row link).
- [x] Phone card:
  - Logo, and tapping the card opens the event.
  - Export PDF and NSED as buttons.
  - Edit and Delete under a ⋯ (bottom sheet).

**Event details** (`src/app/(admin)/events/details/page.tsx`)

- [x] Campus logo beside the title: 64px on web, 48px on phone. (The header `logo` prop comes from DRRM-034; if that isn't merged yet, add it here.)
- [x] New `CampusBackdrop` component, absolutely positioned at the top of the content area:
  - About 600px tall.
  - The campus logo about 560px wide (340px on phone), top-right, partly off the edge.
  - Opacity .07 (dark .05), `blur(4px)`.
  - `mask-image: linear-gradient(to bottom,#000 30%,transparent)`, plus a faint maroon radial wash.
  - `aria-hidden` and `pointer-events-none`.
  - Cards stay solid `bg-surface`, so contrast doesn't change.

**Reports list** (`src/app/(admin)/reports/page.tsx`)

- [x] Event column: campus logo (26px), the event name, and the campus name under it.
- [x] The row opens the report drawer (DRRM-033 row link), like the Edit icon.

---

## 4. Technical Design

- [`src/lib/campus-logo.ts`](../../../src/lib/campus-logo.ts) already resolves logos by campus name; reuse it.
- `CampusBackdrop` goes in `src/app/(admin)/_components/`; DRRM-036 reuses it on campus details.
- `ExportNsedButton` is a local function in [`src/app/(admin)/events/details/page.tsx`](<../../../src/app/(admin)/events/details/page.tsx>): move it to `src/app/(admin)/events/_components/` and add an icon variant for the row.

---

## 5. Implementation Tasks

- [x] Events: logo column, NSED icon action, phone card changes
- [x] `CampusBackdrop` and the event details logo
- [x] Reports: Event column with logo, row opens drawer
- [x] Update `docs/modules/events.md` and `field-reports.md`

---

## Notes from the build

- `CampusMark` now takes any size and falls back to the UP seal (`fallback="seal"`, default) instead of the campus initials; `fallback="initials"` keeps the old look.
- The backdrop sits at `-z-10` behind the content; for that, `AdminShell`'s root gets `isolate` and `<main>` gets `relative`. The ⋯ bottom sheet is now portalled to `<body>`, so it stays above the tab bar wherever it is opened.
- The Reports row opens a drawer, not a page, so `DataTable` got `onRowClick` and `NameCell` `opensRow` (the reporter's name is the row's button); `MobileCard` got `onOpen` and `menu`.
- The row's NSED export fetches the event's summary only when clicked (`useExportNsed`).
- Checked in a temporary preview with sample data (the dev database was unreachable): Events at 1280 px (logos, NSED only on completed UP Manila and PGH rows, row hover), the phone card and its ⋯ sheet, Reports (logo column, a click on the Event cell opens the drawer), event details light and dark and at 390 px (logo, backdrop, no sideways scroll).

## 6. Out of Scope

- Profile photos in Reported by: DRRM-039.
