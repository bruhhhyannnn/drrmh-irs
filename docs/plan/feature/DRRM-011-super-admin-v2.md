---
type: feature
ticket: DRRM-011
status: in-review
branch: feat/DRRM-011-super-admin-v2
modules:
  - '[[dashboard]]'
  - '[[events]]'
  - '[[field-reports]]'
  - '[[bystander-reports]]'
  - '[[users]]'
  - '[[settings-lookups]]'
  - '[[campus-scoping]]'
  - '[[print]]'
  - '[[design-system]]'
tags: [plan, feature]
---

# [DRRM-011] Feature Plan: Super Admin v2

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-011-super-admin-v2`
- **Owner / Author:** Bryan Mangapit
- **Design source:** Claude Design project → `DRRM-H Redesign - Super Admin.dc.html` (SA1–SA23, web 1140 / tablet 768 / phone 390) and `DRRM-H Redesign - Super Admin new features.dc.html` (report PDF 5a, Complete event SA8b, comparison SA8c, field order SA22). Builds on DRRM-009 / DRRM-010 (shared `src/components/ds`).

---

## 1. Problem Statement & Motivation

The (admin) pages still used the original template: a collapsible sidebar with a Settings submenu, an "All campuses" filter repeated on Events, Users and Clusters, modals for every form, bare icon actions, pie charts that need a hover to read, and an event summary that stacked one card per cluster. A super admin running a drill had no single view of what is ongoing, could not complete an event in one step, and had no report to hand in afterwards.

The redesign gives every page one shell (sidebar on web, icon rail on tablet, bottom tabs on phone), one table pattern (rows become cards on phone), one drawer for every add / edit / detail view, and one event summary shared by campus details and event details. It adds Complete event, Compare with last drill and an event report PDF.

---

## 2. Requirements & User Stories

- **As a super admin**, I want to switch campus once in the top bar instead of filtering every list.
- **As a super admin**, I want the dashboard to open on what is ongoing now: clusters reported, reports, casualties and missing for each event.
- **As a super admin**, I want to create the same drill for several campuses at once, complete it in one step, and compare it with the last drill.
- **As a super admin**, I want an event report I can save as PDF for the drill report.
- **As a super admin**, I want to reorder a campus's population fields by dragging.

Acceptance criteria:

- [x] Shell: sidebar (Dashboard; Records: Events, Reports, Bystander reports with a pending badge; Manage: Campus, Users, Settings) on web, 88px icon rail on tablet, bottom tabs (Home, Events, Reports, Bystander, More) on phone. Inactive items #475467.
- [x] Top bar: campus switcher (All campuses or one campus, remembered) and the account button, which opens My profile (drawer) with Sign out.
- [x] Dashboard (SA1 / SA1b): Ongoing now, one card per event and campus; when nothing is ongoing it stays and shows the next event (or Add event). Tiles link to their pages. Reports by cluster as ranked bars, Events by status, this month's calendar and agenda.
- [x] Campus (SA3 / SA4 / SA5): cards with events, users and fields (warning without fields); Add / Edit campus drawer; details with labelled Edit / Delete, an event picker and the shared summary.
- [x] Events (SA6 / SA7 / SA9): status tabs with counts, Campus column only under All campuses, icon actions with tooltips, cards on phone. Add event can create one event per ticked campus. Delete names the event and its linked reports.
- [x] Event details (SA8 / SA8b / SA8c): Complete event (asks first, names clusters with no report, can complete the same event at other campuses), completed banner with who and when, Export PDF, Edit, Delete.
- [x] Summary: Overview tiles, Compare with last drill (measure table + two paired charts), Clusters table with units and No report yet, Headcount ranked bars, Casualties and Missing persons tables (five rows, then Show all), Analytics (reports over time, time to first report, casualties by condition, structural damage).
- [x] Event report PDF (5a): letterhead, event block, summary, comparison, clusters, headcount, every casualty and missing person, analytics, Prepared by / Noted by; running header and Page x of y.
- [x] Reports (SA10 / SA11): search by name, cluster or unit; event and cluster filters; 10 per page; Edit report drawer with steppers, people drawers and damage tiles.
- [x] Bystander reports (SA12 / SA13): opens on Needs action; one next step per row (Review / Verify); details drawer with the status actions in its footer.
- [x] Users (SA14 / SA15): Active switch with Undo, Profile incomplete flag, Add / Edit user drawer grouped Name / Account / Assignment / Access with a live password checklist and a 3-way user type.
- [x] Settings (SA16–SA23): one page with tabs; Active switch in each row; drawer forms with inline errors; Population fields one campus at a time with drag to reorder.
- [x] Status colours: ongoing / verified / active green; upcoming / pending amber; completed / reviewed blue; dismissed / inactive grey; red only for casualties and delete.
- [x] Light theme, Figtree + Spline Sans Mono, no horizontal scroll from 320px up.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- `events.completed_by` (nullable FK → `users.id`, `ON DELETE SET NULL`), relation `Event.completer`. Set by Complete event and when the edit form changes the status to Completed; cleared when it changes away.
- **Run `prisma/manual/DRRM-011-super-admin-v2.sql` in Supabase before deploying** — Prisma selects the new column.

### Server Actions & Data Flow

- `src/actions/dashboard` (new) `getDashboard(campusId, monthStart, monthEnd)`: counts, Ongoing now cards (clusters reported of active clusters, reports, casualties, missing), the next upcoming event grouped by name, top clusters by reports, events by status, this month's events. The month window comes from the browser so it follows the admin's time zone. Hook: `use-dashboard.ts`.
- `src/actions/events`: `createEvents(data, campusIds)` (one event per ticked campus, in a transaction), `completeEvents(ids, userId)` (status Completed, `ended_at` now, `completed_by`), `getSiblingOngoingEvents`, `getCampusEventOptions` (Compare with menu, campus event picker), `getOngoingEventOptions` (Add report), `getEventSummarySource` (event, reports with people / headcount / damage, active clusters, campus fields). `getEvent` adds the completer and report count.
- `src/actions/campus-table`: `getCampusesOverview` / `getCampusOverview` with counts of events, users, clusters and active population fields. The old per-event headcount / damage queries are gone (the summary covers them).
- `src/actions/reports`: `getReports` searches reporter names and filters by event and cluster; `saveReportEdits` writes where, headcount, people and damage in one update (nested `deleteMany` + `create`), validated with `reportSchema`. Removed the old dashboard aggregates.
- `src/actions/emergency-reports`: `getBystanderReports(campusId?)`, `getPendingBystanderCount(campusId?)`; reports include their damage condition.
- `src/actions/settings`: rows include their parent and linked counts (units, users, reports, casualties) for the Units column and delete warnings. `src/actions/users`: `setUserActive` (switch + Undo) replaces `toggleUserStatus`.
- Hooks invalidate every view that shows the changed data (events → dashboard, campus overview, summaries). Bystander hooks moved to `src/components/hooks/use-bystander-reports.ts`. Field reordering is optimistic and rolls back on error.
- `src/lib/schemas.ts`: `eventSchema` takes `campus_ids`; lookup schemas use the design's error wording ("Enter a cluster name.").

### UI & User Interaction

- Shell `src/app/(admin)/_components/shell`: sidebar (web), icon rail (tablet), bottom tabs + More sheet (phone), top bar with the campus switcher (`useCampusScopeStore`, remembered per device) and the account button, which opens My profile (`src/components/auth/profile-drawer.tsx`, also used by the ERT top bar now).
- Kit `src/app/(admin)/_components`: `data-list` (tabs, search, filters, grid table with tablet-only column hiding, phone cards, icon actions with tooltips, pager), `drawer-parts`, `confirm-dialog`, `page-header`, `ui` (chips with the shared status colours, campus marks, bars, date blocks).
- Summary `_lib/summary.ts` (pure) + `_components/summary`: Overview tiles, Compare with last drill (measure table, paired charts), Clusters (units nested, No report yet, Total), Headcount ranked bars, Casualties / Missing tables (five, then Show all), Analytics (reports per bin, time to first report, casualties by condition, structural damage). Shared by campus details, event details and `src/app/(print)/events/report` (the A4 report).
- Pages: dashboard, campus (+ drawer), campus details, events (+ add / edit drawer, delete dialog), event details (+ Complete event), reports (+ add / edit drawer), bystander reports (+ details drawer), users (+ drawer), settings (one page, tabs; `LookupTable` + drawer; population fields with drag and keyboard reordering, edit field drawer).
- `src/components/ds`: `Switch` / `SwitchField`, `LocationPicker` (moved out of the ERT location section), drawer `eyebrow` / `titleAside` / `size="wide"`, button variants `danger` and `destructive`.
- Removed: the old sidebar / header / backdrop, sidebar and theme stores, `ThemeProvider`, `ProfileModal`, `SignOutButton`, the admin `ReportForm` and modals, `EventForm`, `UserForm`, `CampusForm`, `components/settings`, the old `event-summary`.

---

## 4. Implementation Tasks

- [x] Task 1: Schema + manual SQL.
- [x] Task 2: Data layer (dashboard, campus overview, event summary, complete / multi-create, report update, scoped queries).
- [x] Task 3: Shell, campus switcher, My profile.
- [x] Task 4: Shared table / drawer / dialog kit.
- [x] Task 5: Pages: dashboard, campus, events (details, complete, compare, PDF), reports, bystander reports, users, settings.
- [x] Task 6: Responsive check at 1140 / 768 / 390 / 320.

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`: clean.
- [x] `npm run type-check`: clean.
- [x] `npm run build`: passes; every admin route and `/events/report` prerender as static.
- [x] Headless Chrome walk-through at 1140 / 768 / 390 / 320 through a temporary preview route that filled the query cache with sample data like the design's (the dev DB doesn't have `events.completed_by` until the SQL runs, and the walk-through must not write data). Screens: dashboard (ongoing and nothing ongoing), campus, campus details, events, event details (ongoing, completed + compare), reports, bystander reports, users, settings clusters, population fields, report preview. No horizontal overflow at any width, no console errors. Drawers / dialogs opened: Add event, Complete event, bystander details, Add user, Edit report, Add cluster (empty submit shows the inline errors).
- [x] Report: printed with Chrome to exactly 4 A4 pages with the sample data.
- [x] Drag to reorder (mouse, and the phone layout) with server calls blocked: the row moves at once, the drop line shows, and it rolls back when the save fails.
- [ ] Not run: any real create / update / delete, and the pages against the real DB — needs the SQL applied first.

Rollout:

1. Run `prisma/manual/DRRM-011-super-admin-v2.sql` in the Supabase SQL editor.
2. Deploy.

Deviations from the design:

- **Appearance (Light / Dark / Auto) is not in My profile, and the old dark-mode toggle is removed.** Every redesigned page is light only.
- **Export PDF opens the report page and the browser's print dialog** (Save as PDF) instead of downloading a file: there is no PDF library, and the design's own code note suggests a print page. The running header and "Page x of y" use `@page` margin boxes (Chrome / Edge 131+); other browsers print without them. The page count follows the data, since every row is printed.
- **Administrators get this shell too, with the campus switcher.** The Admin design (AD1–AD20: campus locked, no Campus page) is a follow-up, done in DRRM-012. Already in: administrators create events, users and clusters for their own campus and can't create super admins.
- Edit report: the headcount steppers are one column; two columns squeezed long field names in the drawer.
- Add report stays (same drawer, an ongoing-event picker, the admin is the reporter, offline queueing kept).
- Bystander Review opens the details drawer; Mark reviewed is in its footer without a confirm; Verify and Dismiss confirm.
- Add user: Cluster and Unit are required for ERT members only (admins have none).
- Edit field: the code can't be changed (the legacy headcount columns are keyed by it).
- Missing persons "Last seen" shows cluster and unit only; there is no last-seen note in the data.
- Casualty severity order and damage colours are read from the condition names, since Settings values are free text.
- Admins can't switch off or delete their own account from Users.
- Added: Export to Excel stays on the events list (its By Cluster sheet now lists the event's own clusters instead of UP Manila's); a Map pin row with an Open map link in bystander details.

Open items:

- [ ] Deleting a bystander report still leaves its photos in Storage (existing behaviour).
- [ ] The PWA install banner covers the phone bottom tabs until dismissed.
- [ ] Server actions still have no server-side role check (true across `src/actions`, see DRRM-008).
