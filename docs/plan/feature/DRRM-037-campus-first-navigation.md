---
type: feature
ticket: DRRM-037
status: done
branch: feat/DRRM-037-campus-first-navigation
modules:
  - '[[routes]]'
  - '[[campus-scoping]]'
  - '[[pillars-and-landing]]'
tags: [plan, feature, design-round-2026-11-11]
---

# [DRRM-037] Feature Plan: Campus-first sidebar, phone tabs and More; remove DRRM pillars from the nav

- **Status:** `[Done]`
- **Target Branch / PR:** `feat/DRRM-037-campus-first-navigation`
- **Owner / Author:** Bryan Mangapit
- **Depends on:** DRRM-036 (campus details for the admin view)

> Design source: the screenshots below are the whole design. Don't open the Claude Design canvas for this ticket; it also holds older turns (1–8) that are already built.
> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`. Afterwards update the module notes listed in `modules:` and add a line to `docs/changelog.md`.

---

## 1. Problem Statement & Motivation

Admins mostly go to one campus's latest event, but the sidebar leads with Events. Campus is buried under Manage.

The DRRM pillars group is no longer used; Assessments covers it.

---

## 2. Design

The sidebar is drawn on every web screen in this round; these show it best:

![SA46 dashboard and sidebar](../../design/2026-11-11-admin-polish/SA46-dashboard-and-sidebar.png)

![SA47 More page on phone](../../design/2026-11-11-admin-polish/SA47-more-phone.png)

![AD25 administrator sidebar](../../design/2026-11-11-admin-polish/AD25-admin-sidebar-dashboard.png)

---

## 3. Requirements & Acceptance Criteria

**Super admin sidebar** (`src/app/(admin)/_components/shell/nav.ts`, `admin-shell.tsx`)

- [x] Order:
  1. Dashboard
  2. **Campuses**: each campus with events, sorted by event count then name (stable).
     - 22px logo before each name.
     - A green "Live" dot when it has an ongoing event.
     - Each opens `/campus/details?id=…`.
     - Then "All campuses" with the campus count → `/campus`.
  3. **Records**: Events, Reports, Bystander reports (badge), Assessments
  4. **Manage**: Users, Settings
- [x] Remove the **DRRM pillars** group. The `/pillars` pages can stay reachable by URL.
- [x] The tablet rail shows the campus logos too.

**Administrator**

- [x] The **Campus** group has only their own campus, which opens their campus page. There is no All campuses.
- [x] Open `/campus/details` to administrators for their own `campus_id` only, read-only: no Edit or Delete.
- [x] `/campus` (the list) stays super admin only. Update the route guard.

**Phone**

- [x] Tabs: Home, Campuses (Campus for administrators), Events, Bystander, More.
- [x] Reports moves to More.
- [x] More (`src/app/(admin)/more/page.tsx`) groups:
  - Records: Reports, Assessments
  - Manage: Users, Settings
  - Account, Appearance (Light / Dark / Device), Sign out

---

## 4. Technical Design

- Campus list for the sidebar: `useCampusesOverview` (counts) plus ongoing events for the Live dot.
- Route guard: see [`docs/modules/routes.md`](../../../docs/modules/routes.md).

---

## 5. Implementation Tasks

- [x] nav.ts: new groups, campuses list, remove pillars
- [x] admin-shell: render campus items with logos and the Live dot; tablet rail
- [x] Phone tabs and More groups
- [x] Admin access to their own campus details (read-only) + guard
- [x] Update `docs/modules/routes.md` and `pillars-and-landing.md`

---

## Notes from the build

- The Live dot comes from `useCampusesOverview`'s `latestEvent` (an ongoing event comes first there), so the sidebar needs no extra query.
- The route guard now blocks `/campus` exactly (`isSuperAdminPath`); the campus page checks the id itself and sends an Administrator to their own campus, with Edit and Delete hidden and no Back link to the list.
- The sidebar and rail read the open campus from the link, so they render inside a `Suspense` boundary.
- Checked in a temporary preview with sample data: the super admin sidebar (campuses with logos, Live on an ongoing one, All campuses with the count, Records, Manage, no pillars), the tablet rail with logos, the phone tabs and More page, and an Administrator's sidebar and read-only campus page (another campus's id redirects to theirs).

## 6. Out of Scope

- The dashboard content is DRRM-038.
