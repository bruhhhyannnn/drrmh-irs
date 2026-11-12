---
type: feature
ticket: DRRM-038
status: done
branch: feat/DRRM-038-dashboard-needs-attention
modules:
  - '[[dashboard]]'
tags: [plan, feature, design-round-2026-11-11]
---

# [DRRM-038] Feature Plan: Dashboard: Needs attention and the campuses

- **Status:** `[Done]`
- **Target Branch / PR:** `feat/DRRM-038-dashboard-needs-attention`
- **Owner / Author:** Bryan Mangapit
- **Depends on:** DRRM-036 (CampusCard)

> Design source: the screenshots below are the whole design. Don't open the Claude Design canvas for this ticket; it also holds older turns (1–8) that are already built.
> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`. Afterwards update the module notes listed in `modules:` and add a line to `docs/changelog.md`.

---

## 1. Problem Statement & Motivation

The dashboard opens with counts and charts. What needs action (bystander reports, live drills, follow-ups) and the campuses people actually go to aren't on it.

---

## 2. Design

![SA46 dashboard](../../design/2026-11-11-admin-polish/SA46-dashboard-and-sidebar.png)

![AD25 administrator dashboard](../../design/2026-11-11-admin-polish/AD25-admin-sidebar-dashboard.png)

---

## 3. Requirements & Acceptance Criteria

**Heading**

- [x] "Good morning / afternoon / evening, {first name}", then the campus scope and today's date.

**Needs attention card**

- [x] Each item is a link, shown only when its count is non-zero. 2 columns on web.

| Item                                                  | Text                                                       | Links to              |
| ----------------------------------------------------- | ---------------------------------------------------------- | --------------------- |
| Pending bystander reports                             | "N bystander reports to review" + "Oldest sent X ago"      | Bystander reports     |
| Each ongoing event                                    | "… is live" + "N of M clusters reported · started 9:00 AM" | The event             |
| Assessments with structural follow-up                 | "N buildings need structural follow-up"                    | Assessments, filtered |
| Campuses without population fields (super admin only) | "N campuses have no population fields yet"                 | Campus                |

**Campuses**

- [x] `CampusCard` (from DRRM-036), compact, for campuses with events.
- [x] 2 columns on web; a horizontal scroll on phone.
- [x] Administrators see their one campus card, full width.

**Below that**

- [x] The four counts, each with a short sub-line. Then Reports by cluster, Events by status, Building safety and the calendar, unchanged.

---

## 4. Technical Design

- [`src/app/(admin)/dashboard/page.tsx`](<../../../src/app/(admin)/dashboard/page.tsx>), [`src/actions/dashboard/index.ts`](../../../src/actions/dashboard/index.ts): add the attention counts, the oldest pending bystander report time, and per ongoing event the clusters reported vs total.

---

## 5. Implementation Tasks

- [x] Action: attention data
- [x] Heading, Needs attention card, campuses strip, reorder
- [x] Update `docs/modules/dashboard.md`

---

## Notes from the build

- Needs attention replaces the old Ongoing now section (the ongoing events are attention items now, as drawn); with nothing to list, the card says so.
- "Structural follow-up" counts active buildings whose latest assessment has `needs_follow_up`. Its link opens `/assessments?filter=follow-up`, which DRRM-042's quick filter reads.
- One campus in scope (an administrator's, or a super admin's switcher pick) shows its full campus card instead of the strip.
- Checked in a temporary preview with sample data: super admin at 1280 px and 390 px (the strip scrolls sideways, no page overflow) and an administrator at 1280 px.

## 6. Out of Scope

- Chart redesigns.
