# [DRRM-012] Feature Plan: Admin v2

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-012-admin-v2`
- **Owner / Author:** Bryan Mangapit
- **Design source:** Claude Design project → `DRRM-H Redesign - Admin.dc.html` (AD1–AD20, web 1140 / tablet 768 / phone 390). Builds on DRRM-011: the same shell, tables, drawers and event summary, with everything about other campuses taken out.

---

## 1. Problem Statement & Motivation

DRRM-011 gave administrators the super admin shell as-is: the campus switcher, the Campus page, Campus columns and Campus fields (disabled, with a "your campus" hint). An administrator runs one assigned campus, so all of that is noise, and the switcher let them browse other campuses' events, reports and users.

---

## 2. Requirements & User Stories

- **As an administrator**, I want every page to show my campus only, without picking it.
- **As an administrator**, I want forms without a Campus field, since everything I add belongs to my campus.

Acceptance criteria (from the design's notes):

- [x] The top bar shows the assigned campus as a label where super admins have the switcher.
- [x] No Campus page. The Manage group starts at Users; `/campus` sends administrators to the dashboard.
- [x] No Campus column on Events, Bystander reports, Users or Clusters (phone cards drop the campus too).
- [x] No Campus field in Add event, Add user or Add cluster. Add user: Cluster and Unit side by side, Position full width; user type ERT or Admin.
- [x] Event titles drop "— Campus" (dashboard, events, event details, delete dialog, reports, report drawer, summary headings).
- [x] Dashboard tiles, Ongoing now and the bystander badge count this campus only. Ongoing now is one column, full width. With nothing ongoing, the next event shows its description instead of a list of campuses.
- [x] Add event creates one event. Complete event has no option for other campuses.
- [x] Population fields has no campus tabs.
- [x] Event details, Complete event, Compare with last drill and Export PDF work as for super admins.
- [x] Super admin screens unchanged.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- None. No schema, SQL or Supabase change: all admin data goes through Prisma server actions, and the scoping is done where the pages pick their campus.

### Server Actions & Data Flow

- `src/actions/dashboard`: `nextEvent` includes the event's `description` (shown to administrators).
- No new actions. Every list already filters by the campus id the page passes in.

### UI & User Interaction

- `src/app/(admin)/_components/shell/campus-switcher.tsx`:
  - `useIsSuperAdmin()`: the one role check the admin pages use.
  - `useScopedCampusId()` returns the administrator's own `campus_id`; super admins keep the switcher's choice. Since every page and hook already reads this, the lists, dashboard, badge and Add forms scope themselves, and the existing "Campus column only under All campuses" rule hides the columns.
  - `useEventTitle()`: "Name — Campus" for super admins, the name alone for administrators.
  - `CampusLabel`: the static campus pill in the top bar.
- `shell/nav.ts`: `navFor(isSuperAdmin)` drops Campus (`SUPER_ADMIN_HREFS`) and moves the Manage heading to Users. Sidebar, rail and bottom tabs / More sheet use it.
- `shell/admin-shell.tsx`: `CampusScopeGate` sends administrators from `/campus*` to the dashboard, and shows "No campus assigned" to an administrator whose profile has no campus (otherwise they'd see every campus).
- Event details and the print report show "Event not found" / "This event no longer exists." when an administrator opens another campus's event by URL.
- Drawers: event, user and cluster forms render the Campus field for super admins only; the form value is still the administrator's campus.
- `settings/_components/population-fields.tsx`: administrators get their campus's table without tabs.

---

## 4. Implementation Tasks

- [x] Task 1: Role-aware campus scope, event titles and campus label.
- [x] Task 2: Nav, route gate and top bar.
- [x] Task 3: Dashboard, events, event details, reports, bystander reports, users, settings.
- [x] Task 4: Responsive check at 1140 / 768 / 390 / 320.

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`: clean.
- [x] `npm run type-check`: clean.
- [x] `npm run build`: passes.
- [x] Headless Chrome walk-through through a temporary preview route (deleted) that signed in a fake Administrator and filled the query cache with sample data, so no server calls ran: dashboard (ongoing and nothing ongoing) at 1140 / 768 / 390 / 320, events (web and phone), Add event, Add user, Add cluster, population fields. No horizontal overflow, no console errors. The same route as a Super Admin still shows the switcher, Campus in the nav, the Campus column and the campus checklist in Add event.
- [ ] Not run: the pages against the real DB with an administrator account, and the `/campus` redirect in a real session.

Rollout: deploy. Nothing to run in Supabase first.

Deviations from the design:

- **The scoping is in the UI only.** Server actions still trust the campus id the page sends, so an administrator calling an action directly could read other campuses (the existing open item: no server-side role check in `src/actions`, see DRRM-008 / DRRM-011). Closing it needs the caller's identity on the server: the Supabase session lives in the browser (local storage), so each action would take the access token and check it with `supabaseAdmin.auth.getUser`.
- Edit user still lists Super Admin when the user being edited is one, so the type isn't changed by accident.

Open items:

- [ ] Server-side role and campus checks in server actions (above).
