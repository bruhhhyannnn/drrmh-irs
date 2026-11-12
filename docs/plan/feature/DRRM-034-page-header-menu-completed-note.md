---
type: feature
ticket: DRRM-034
status: done
branch: feat/DRRM-034-page-header-menu-completed-note
modules:
  - '[[design-system]]'
  - '[[events]]'
tags: [plan, feature, design-round-2026-11-11]
---

# [DRRM-034] Feature Plan: Page header: rare actions in a ⋯ menu; completed note that minimizes

- **Status:** `[Done]`
- **Target Branch / PR:** `feat/DRRM-034-page-header-menu-completed-note`
- **Owner / Author:** Bryan Mangapit
- **Depends on:** DRRM-033 (hover tokens)

> Design source: the screenshots below are the whole design. Don't open the Claude Design canvas for this ticket; it also holds older turns (1–8) that are already built.
> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`. Afterwards update the module notes listed in `modules:` and add a line to `docs/changelog.md`.

---

## 1. Problem Statement & Motivation

Page headers show every action as a button. Edit and Delete are rarely used, and they crowd the exports people do use.

The completed-event note (CompletedBanner) is long, sits above the numbers, and can't be closed.

---

## 2. Design

![SA42 page header actions](../../design/2026-11-11-admin-polish/SA42-page-header-actions.png)

![SA43 completed note](../../design/2026-11-11-admin-polish/SA43-completed-note.png)

---

## 3. Requirements & Acceptance Criteria

**PageHeader** (`src/app/(admin)/_components/page-header.tsx`)

- [x] Rule:
  - Frequent actions stay as buttons: exports, "Add …", and Complete event on an ongoing event.
  - Rare actions go into one ⋯ menu: Edit, Delete, Edit checklist, Population fields.
  - ⋯ shows only when it has items.
- [x] `actions` stays for the visible buttons. A new `menu` prop takes items `{ label, icon, onSelect | href, danger? }`.
- [x] ⋯ is a 44px round outline button with an `Ellipsis` icon and `aria-label="More actions"`.
- [x] On web, the menu:
  - Has `role="menu"` and opens under the button, aligned right.
  - Arrow keys move between items, Esc closes, and focus returns to ⋯.
  - Danger items come last, after a separator, in red.
- [x] On phone:
  - The visible buttons wrap into a row under the title.
  - ⋯ stays beside the title and opens a bottom sheet with the items and Cancel.
- [x] Event details:
  - Buttons: Export PDF (primary), then Export NSED report (outline, only when `nsedTemplateFor()`).
  - Complete event comes first while the event is ongoing.
  - ⋯ holds Edit event, a separator, then Delete event.
  - Pass `logo` (`CampusMark`) so the campus logo shows beside the title.
- [x] Campus details: Edit campus, Population fields and Delete campus go into ⋯.
- [x] Assessments: Edit checklist goes into ⋯.
- [x] Assessment details: Print stays a button; Delete goes into ⋯.

**Completed note** (`CompletedBanner` in `src/app/(admin)/_components/summary/sections.tsx`)

- [x] Minimized:
  - The note is not shown.
  - The status chip becomes a button: "Completed", a lock icon and a chevron, with `aria-expanded` and `aria-controls`.
  - Selecting the chip opens the note in place.
- [x] Open:
  - A chevron-up icon button ("Minimize") closes it.
- [x] First visit to a completed event:
  - The note is open, then minimizes itself after 8s.
  - A 3px bar along its bottom counts down.
  - Pointer hover or focus inside the note pauses the count.
  - A "Keep open" link stops it.
  - With `prefers-reduced-motion`, there is no bar animation, but the timer still runs.
- [x] Remember the state per event in localStorage (`irs.completedNote.<eventId>`), with every read and write in try/catch. Later visits start minimized unless the user kept it open.
- [x] When open, the note still says which clusters didn't report.
- [x] Event details and campus details both use it.

---

## 4. Technical Design

- [`src/app/(admin)/_components/page-header.tsx`](<../../../src/app/(admin)/_components/page-header.tsx>): new `menu` prop, ⋯ button, dropdown and phone sheet. Reuse an existing popover or sheet primitive if `src/components/ds` has one.
- [`src/app/(admin)/events/details/page.tsx`](<../../../src/app/(admin)/events/details/page.tsx>), [`src/app/(admin)/campus/details/page.tsx`](<../../../src/app/(admin)/campus/details/page.tsx>), `src/app/(admin)/assessments/…`: move actions.
- [`src/app/(admin)/_components/summary/sections.tsx`](<../../../src/app/(admin)/_components/summary/sections.tsx>): `CompletedBanner` state, and the chip button in the header.

---

## 5. Implementation Tasks

- [x] PageHeader `menu` + ⋯ (web dropdown, phone sheet, keyboard)
- [x] Move actions on event details, campus details, assessments, assessment details
- [x] Completed note: minimized chip, open state, auto-minimize, remember per event
- [x] Check light and dark, phone and web
- [x] Update `docs/modules/design-system.md` and `events.md`

---

## Notes from the build

- The PageHeader ⋯ menu (and the moves on event details, campus details, assessments and assessment details, plus the campus logo beside the event title) was already on main, built from the same design as `plan/feature/DRRM-033-page-header-menu` (PR #112). This branch adds the completed note.
- The note's state lives in `useCompletedNoteStore`, so the chip in the page header and the note in the event summary agree; `src/lib/completed-note.ts` holds the storage key and the start rules (6 tests).
- Checked in a temporary preview (light, dark, 390 px): first visit open with the countdown; hover pauses it; it minimizes after 8 s and remembers `closed`; a revisit starts minimized; the chip opens it (no countdown, remembers `open`); Minimize closes it and focus returns to the chip; Keep open stays open and is remembered.

## 6. Out of Scope

- Row action icons in tables stay as they are.
