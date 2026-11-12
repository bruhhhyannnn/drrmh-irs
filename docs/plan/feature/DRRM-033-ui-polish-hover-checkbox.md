---
type: feature
ticket: DRRM-033
status: in-progress
branch: feat/DRRM-033-ui-polish-hover-checkbox
modules:
  - '[[design-system]]'
  - '[[events]]'
tags: [plan, feature, design-round-2026-11-11]
---

# [DRRM-033] Feature Plan: Visible hover, whole-row click, one Checkbox, casualties column fix

- **Status:** `[In Progress]`
- **Target Branch / PR:** `feat/DRRM-033-ui-polish-hover-checkbox`
- **Owner / Author:** Bryan Mangapit

> Design source: the screenshots below are the whole design. Don't open the Claude Design canvas for this ticket; it also holds older turns (1–8) that are already built.
> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`. Afterwards update the module notes listed in `modules:` and add a line to `docs/changelog.md`.

---

## 1. Problem Statement & Motivation

Four small UI problems in shared components:

- Hovers use `hover:bg-gray-50` (#f9fafb) on white surfaces. That is about 1.03:1 contrast, so it looks like nothing happens. It is used 33 times.
- Table rows have no hover. Rows can't be clicked; only the name link opens the record.
- The browser's own checkbox still shows in three places, while the app already draws its own square elsewhere.
- Bug: on event details, the Casualties table's Condition chip overlaps the "What happened" column.

**Users:** Super Admins and Administrators.

---

## 2. Design

![SA45 hover states](../../design/2026-11-11-admin-polish/SA45-hover-states.png)

![SA59 checkbox](../../design/2026-11-11-admin-polish/SA59-checkbox.png)

![SA44 casualties table fix](../../design/2026-11-11-admin-polish/SA44-casualties-table-fix.png)

Whole-row click and row hover in context (Events list, row 2 is hovered):

![SA48 events list](../../design/2026-11-11-admin-polish/SA48-events-list.png)

---

## 3. Requirements & Acceptance Criteria

**Hover tokens**

- [x] New tokens in `src/app/globals.css`:
  - `--hover`: gray-100 (#f2f4f7); dark #252c3a
  - `--hover-strong`: gray-200 (#e4e7ec); dark #2e3543
  - Exposed as Tailwind colours `bg-hover` and `bg-hover-strong`.

**Every `hover:bg-gray-50` replaced**

| Element                     | Hover                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Rows, nav items, menu items | `bg-hover`                                                                                                    |
| Icon buttons                | `bg-hover-strong`, icon from gray-500 to ink                                                                  |
| Outline buttons             | border gray-400 + `bg-hover`                                                                                  |
| Primary buttons             | brand-600 (#7f1616) + `shadow-[0_6px_14px_rgba(161,29,29,.28)]`, instead of `brightness-92`                   |
| Clickable cards             | border gray-300 + `shadow-[0_10px_24px_rgba(16,24,40,.12)]` + `-translate-y-0.5` (none under `motion-reduce`) |
| Links                       | brand-600 + 2px underline, offset 3px                                                                         |
| Tabs                        | ink text + gray-300 underline; the current tab keeps its maroon underline                                     |

All hovers ease in over 120ms. Focus rings are unchanged.

**DataTable rows**

- [x] Rows that open something:
  - Get `bg-hover` and a 3px maroon inset edge (`shadow-[inset_3px_0_0_var(--brand-solid)]`).
  - Their name link turns maroon and underlined.
  - Have `cursor-pointer`.
- [x] Rows that open nothing get the background only.
- [x] DataTable takes an optional row link (for example `rowHref(row)`) and uses a stretched link:
  - The name `<a>` gets `after:absolute after:inset-0`, and the row is `relative`.
  - Action buttons are `relative z-10`, so they still work on their own.
  - The name stays a real link for keyboard and screen readers.
- [x] Use the row link on Events (opens event details). Remove the **View** button there.

**Checkbox component** (`src/components/ds/checkbox.tsx`, exported from `ds/index.ts`)

- [ ] `Checkbox` structure:
  - A `<label>` with a visually hidden native `<input type="checkbox" className="peer sr-only" {...props}>`, so `form.register()` works.
  - A 20px square, radius 6px, 1.5px border.
  - The label text and an optional `description` under it.
- [ ] States:
  - Default: border gray-300, surface.
  - Hover: border gray-400, `bg-hover`.
  - Checked: brand-solid fill with a white tick (12px, stroke 3). Hover: brand-600.
  - Partial: a white dash, `aria-checked="mixed"` (set `indeterminate` on the input).
  - `focus-visible`: 2px ring with 2px offset.
  - Disabled: gray-100 fill, gray-200 border. Disabled and checked: gray-300 fill.
  - Error (`aria-invalid`): error-600 border, with the message linked by `aria-describedby`.
- [ ] The whole row toggles, and is at least 44px tall on touch screens.
- [ ] Move the `CheckBox` square out of `src/app/(admin)/_components/confirm-dialog.tsx` into the ds file. `confirm-dialog.tsx` and `events/_components/event-drawer.tsx` import it from there.
- [ ] Replace the browser checkboxes:
  - `src/components/auth/off-campus-setup.tsx`: "same address as home" and the consent checkbox. The consent shows its error message.
  - `src/app/(admin)/dashboard/_components/building-safety/building-level.tsx`: Show pillars, with a 14px label.

**Casualties fix** (`src/app/(admin)/_components/summary/sections.tsx`)

- [ ] `CAS_GRID` gives Condition `minmax(150px,.9fr)` (lg and md) instead of 124–128px.
- [ ] `Chip` (`src/app/(admin)/_components/ui.tsx`) gets a `wrap` prop: `h-auto min-h-6 py-0.5 whitespace-normal rounded-[12px]`, with the dot aligned to the first line.
- [ ] Use `wrap` in the Casualties table, the phone list and the Damage table.
- [ ] Check with "Minor injuries — no hospitalization needed".

---

## 4. Technical Design

- [`src/app/globals.css`](../../../src/app/globals.css): add the two tokens and their dark values.
- [`src/app/(admin)/_components/data-list.tsx`](<../../../src/app/(admin)/_components/data-list.tsx>): row hover and the optional row link.
- [`src/app/(admin)/_components/ui.tsx`](<../../../src/app/(admin)/_components/ui.tsx>): `Chip` `wrap` prop and the button hovers.
- [`src/app/(admin)/_components/confirm-dialog.tsx`](<../../../src/app/(admin)/_components/confirm-dialog.tsx>): import the square from ds.
- [`src/components/auth/off-campus-setup.tsx`](../../../src/components/auth/off-campus-setup.tsx), [`src/app/(admin)/dashboard/_components/building-safety/building-level.tsx`](<../../../src/app/(admin)/dashboard/_components/building-safety/building-level.tsx>): use `Checkbox`.
- [`src/app/(admin)/events/page.tsx`](<../../../src/app/(admin)/events/page.tsx>): row link; remove View.
- Find every `hover:bg-gray-50` with `rg "hover:bg-gray-50" src` and replace it per the table.

---

## 5. Implementation Tasks

- [x] Tokens and Tailwind colours
- [ ] Replace hover classes across `src/` (33 places), then check light and dark
- [x] DataTable row hover and row link; use on Events; remove View
- [ ] `Checkbox` component; move the square; replace the three browser checkboxes
- [ ] Chip `wrap` and the casualties and damage columns
- [ ] Update `docs/modules/design-system.md` and `events.md`

---

## 6. Out of Scope

- Row links on Reports, Bystander reports and Assessments come in later tickets (DRRM-035, DRRM-042).
- The PageHeader menu is DRRM-034.
