---
type: feature
ticket: DRRM-033
status: in-review
branch: feat/DRRM-033-page-header-menu
modules:
  - '[[design-system]]'
  - '[[events]]'
tags: [plan, feature]
---

# [DRRM-033] Feature Plan: PageHeader ⋯ menu (exports stay out, Edit and Delete go in)

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-033-page-header-menu`
- **Owner / Author:** Bryan Mangapit

---

## 1. Problem Statement & Motivation

Round 2 of the redesign (Super Admin turn 9, screen **SA42**, item 2 of `CHANGES for Claude Code.md`). Page headers show every action as a button, so on event details Edit and Delete sit next to the exports people actually use, and a red Delete is one tap from Export PDF.

The rule from the design: actions people use often stay as buttons (Export PDF, Export NSED report, "Add …" on list pages, Complete event on an ongoing event). Rare ones (Edit, Delete, Edit checklist, Population fields and the like) go into one ⋯ (More actions) menu, which only shows when it has items.

**Users:** Administrators and Super Admins.

---

## 2. Requirements & User Stories

- **As an admin**, I want the exports to be the visible buttons on an event so I can get the report out quickly, and Edit and Delete out of the way so I don't hit them by mistake.
- Acceptance criteria:
  - [x] `PageHeader` takes `menu`: items `{ label, icon, onSelect | href, danger? }`; falsy entries are skipped, so `isSuperAdmin && {…}` works. ⋯ only shows when there is at least one item.
  - [x] ⋯ is a 44 px round "More actions" button (`Ellipsis`) after the buttons.
  - [x] Tablet and web: a `role="menu"` dropdown under the button, aligned right. Arrow keys, Home and End move between items (wrapping), Esc closes and focus returns to ⋯; Tab or a click outside closes it.
  - [x] Danger items come last, after a separator, in red.
  - [x] Phone: the visible buttons wrap into a row under the title; ⋯ stays beside the title and opens a bottom sheet (page title, "More actions", the items with icon tiles, Cancel). Esc closes, Tab stays inside.
  - [x] After an item is picked, focus goes back to ⋯ before the action runs, so a dialog or drawer it opens returns focus there.
  - [x] Event details: Complete event (during a drill), Export PDF (primary, outline while Complete event is shown), Export NSED report (where `nsedTemplateFor()`); ⋯ holds Edit event, then Delete event. The campus logo (`CampusMark`) now shows beside the title.
  - [x] Campus details: ⋯ holds Edit campus, Population fields (opens Settings › Population fields with that campus picked, `?campus=`), then Delete campus.
  - [x] Assessments: Edit checklist moves into ⋯ (Super Admin only).
  - [x] Assessment details: Print stays a button; Delete assessment moves into ⋯ (Super Admin only).
  - [x] Checklist editor: Delete draft moves into ⋯ by the same rule; New draft version, Add section and Publish version stay buttons.
  - [x] List pages keep their "Add …" button.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- None.

### Server Actions & Data Flow

- None. Population fields reads an optional `?campus=` (`useSearchParams`, so `SettingsPage` wraps `PopulationFields` in `Suspense`); a picked tab still wins, then the link, then the switcher's campus.

### UI & User Interaction

- New [header-menu.tsx](<../../../src/app/(admin)/_components/header-menu.tsx>): `HeaderMenu` (`variant: 'dropdown' | 'sheet'`), `HeaderMenuItem`, `orderMenuItems`. The sheet uses framer-motion like `RateAppDialog` (reduced motion respected).
- [page-header.tsx](<../../../src/app/(admin)/_components/page-header.tsx>) renders two instances: the sheet one beside the title below `md`, the dropdown one after the buttons from `md`. The actions row is hidden on phone when it would only hold ⋯.
- Pages: `events/details`, `campus/details`, `assessments`, `assessments/details`, `assessments/checklist`, `settings/_components/{settings-page,population-fields}.tsx`.
- Colours are theme tokens (`bg-surface`, `bg-line`, `gray-*`, `error-*`), no `dark:`. Hover uses `bg-gray-100` for now; item 7 (hover tokens) will move it to `--hover`.

---

## 4. Implementation Tasks

- [x] Task 1: `HeaderMenu` (dropdown and sheet) and the `menu` prop on `PageHeader`
- [x] Task 2: Move rare actions into ⋯ on the five pages; logo on event details
- [x] Task 3: `?campus=` on Population fields
- [x] Task 4: Responsive and theme check (light and dark, 1280 and 390 px)

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`
- [x] Temporary preview route with `AdminShell` + `PageHeader`, driven over CDP: at 1280 px the dropdown opens under ⋯; Enter opens it with focus on the first item, ArrowDown/ArrowUp wrap, Esc closes with focus back on ⋯ (`aria-expanded=false`), picking Delete runs it and focus is on ⋯. The same at 390 px with the sheet. No horizontal overflow at either width; light and dark checked.
- [ ] In the app: Edit event, Delete event, Edit campus, Population fields (opens on that campus), Delete campus, Edit checklist, Delete assessment, Delete draft each open what they did before.
- [x] Documentation: [[design-system]] (the `PageHeader` row), [[changelog]], [[00-index]].
