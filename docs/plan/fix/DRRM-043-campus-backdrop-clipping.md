---
type: fix
ticket: DRRM-043
status: done
branch: fix/DRRM-043-campus-backdrop-clipping
modules:
  - '[[events]]'
  - '[[campus-scoping]]'
tags: [plan, fix]
---

# [DRRM-043] Fix Plan: Campus backdrop cut off on wide screens

- **Status:** `[Done]`
- **Related Bugs / Audits:** the campus page screenshot (UP Diliman, laptop width)
- **Target Branch / PR:** `fix/DRRM-043-campus-backdrop-clipping`
- **Author:** Bryan Mangapit

---

## 1. Objective & Scope

`CampusBackdrop` (the faded logo behind the top of the campus page and event details) was
positioned against `<main>`, which is centred and capped at `max-w-7xl` (1280 px). When the
content column is wider than that, the backdrop's `overflow-hidden` box stopped at `<main>`'s
right edge, so the logo and maroon wash ended in a hard vertical line partway across the canvas,
and the logo sat inside the content instead of off the window's edge.

Non-goals: the logo's size, opacity, blur and mask are unchanged.

---

## 2. Technical Solution & Changes Required

### 2.1 Frontend

- [x] `src/app/(admin)/_components/shell/admin-shell.tsx`: `relative` moves from `<main>` to the
      content column (the `md:pl-22 lg:pl-60` wrapper), which always reaches the window's right edge.
- [x] `src/app/(admin)/_components/campus-backdrop.tsx`: the backdrop starts under the top bar
      (`top-15`, `md:top-16`) now that its box starts at the top of the column.

Nothing else is absolutely positioned against `<main>`.

---

## 3. Verification

- [x] `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`
- [ ] Campus page and event details at phone, tablet, laptop and wide desktop widths: the logo runs
      off the window's right edge, with no hard edge and no horizontal scroll.
