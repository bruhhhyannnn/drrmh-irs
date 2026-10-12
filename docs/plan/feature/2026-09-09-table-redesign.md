# [FEAT-UI-TABLES] Feature RFC / Plan: Data Tables Redesign & UI/UX Modernization

- **Status:** `Approved`
- **Target Branch / PR:** `feature/table-redesign`
- **Owner / Author:** DRRM-H Dev Team

---

## 1. Problem Statement & Motivation

The existing data tables across the DRRM-H Incident Reporting System have accumulated visual and UX pain points:

- **Action Column Bloat & Scalability**: Row actions (`Edit`, `Delete`, `View`, `Export`, `Review`, `Verify`, `Dismiss`) are rendered as inline text buttons. On tables with 4-5 actions (e.g., `events`, `emergency-reports`), this balloons column width (350px-450px), causes horizontal overflow, and makes extending actions for other tabs/roles cumbersome.
- **Inconsistent & Incomplete Timestamps**: Date and time formatting varies wildly across pages (`MMM d, yyyy | h:mm a` in events, stacked 2-line in reports, date-only in emergency-reports and settings), omitting critical times on emergency submissions.
- **Filter Dropdown Misalignment**: In `Select`, container classes fail to reach the wrapper `div`, and `Dropdown` lacks `min-w-full` and `text-left`. This causes the "All campuses" placeholder to wrap into centered italic text while options below are left-aligned.
- **Events Table Inconsistency**: The events page uses primitive `Table` elements instead of `DataTable`, missing column sorting, standard pagination, and loading skeletons.

---

## 2. Requirements & User Stories

- **As an Admin**, I want a clean, responsive table with an organized action menu so I can quickly perform primary actions (e.g., View) while accessing secondary actions without visual clutter.
- **As an Admin**, I want accurate, readable timestamps (Date + Time) across all reports and events with full timestamp tooltips.
- **As an Admin**, I want filter dropdowns to be cleanly aligned and legible without strange text wrapping or centering.

### Key Acceptance Criteria

- [ ] Create and switch to `feature/table-redesign` from `feature/sidebar-and-header-ui-enhancement`.
- [ ] Fix `Select`, `Dropdown`, and `DropdownItem` so "All campuses" and options are left-aligned with proper minimum width.
- [ ] Implement portal-backed `<RowActions>` component with hybrid support (quick primary icon button + 3-dots overflow menu).
- [ ] Implement `<DateTimeCell>` with stacked 2-line layout and full timestamp tooltips.
- [ ] Modernize `Table` styling with crisp headers, smooth row hover, and animated skeleton loading in `DataTable`.
- [ ] Migrate `events/page.tsx`, `reports/page.tsx`, `emergency-reports/page.tsx`, `users/page.tsx`, and `settings-table-page.tsx`.

---

## 3. Architecture & Technical Design

### UI Components (`src/components/ui/`)

1. **`form.tsx` & `dropdown.tsx`**:
   - `Select`: Pass wrapper width classes to container `div`; ensure `min-w-full` on dropdown.
   - `DropdownItem`: Add `text-left` and consistent typography; eliminate awkward centered wrapping.
2. **`table-actions.tsx` & `row-actions.tsx`**:
   - Radix Portal-backed dropdown menu: ensures zero clipping from `overflow-x-auto` table containers.
   - Hybrid mode: renders pinned primary actions as icon buttons with tooltips, and collateral actions in `...` menu.
3. **`date-cell.tsx`**:
   - Stacked 2-line date/time presentation:
     - Line 1: `MMM d, yyyy` (`text-sm font-medium text-gray-900 dark:text-gray-100`)
     - Line 2: `h:mm a` (`text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums`)
     - Tooltip: exact full datetime + relative age (`formatDistanceToNow`).
4. **`data-table.tsx` & `table.tsx`**:
   - Skeleton loader rows during `loading={true}`.
   - Polished empty state with icon and helper text.
   - Modernized header typography and sort icons.

---

## 4. Implementation Tasks

- [x] Task 1: Create `feature/table-redesign` branch
- [ ] Task 2: Fix dropdown alignment and placeholder styling in `form.tsx` and `dropdown.tsx`
- [ ] Task 3: Build `<DateTimeCell>` and test date formats
- [ ] Task 4: Build portal-backed `<RowActions>` component with hybrid mode
- [ ] Task 5: Enhance `Table` and `DataTable` (skeletons, empty states, header polish)
- [ ] Task 6: Migrate `events/page.tsx` to `DataTable` with `<RowActions>` and `<DateTimeCell>`
- [ ] Task 7: Migrate `reports/page.tsx`, `emergency-reports/page.tsx`, `users/page.tsx`, and `settings-table-page.tsx`
- [ ] Task 8: Verification with `npm run type-check`, `npm run lint`, and `npm run build`
