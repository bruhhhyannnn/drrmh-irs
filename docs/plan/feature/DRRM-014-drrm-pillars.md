# [DRRM-014] Feature Plan: DRRM pillars in the admin sidebar

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-014-drrm-pillars`
- **Owner / Author:** Bryan Mangapit
- **Source:** request to add the four DRRM pillars to the admin app as their own pages, to plan the next apps. Stacked on `feat/DRRM-013-ui-polish`.

---

## 1. Problem Statement & Motivation

The DRRM-H office wants more apps beyond incident reporting, one for each of the four pillars of disaster risk reduction and management (Republic Act No. 10121):

1. **Disaster Prevention and Mitigation**: avoiding hazards and reducing vulnerabilities and exposure before a disaster (hazard and risk mapping, student-led school watching, disaster-resilient building designs).
2. **Disaster Preparedness**: building the capacity to anticipate, cope with and respond to emergencies (contingency planning, quarterly multi-hazard drills, early warning systems, training DRRM teams).
3. **Disaster Response**: immediate action during or right after a disaster to save lives and meet basic needs (activating emergency response units, rapid damage reports such as RADaR within 72 hours, managing evacuation centers and temporary learning spaces).
4. **Disaster Rehabilitation and Recovery**: restoring and improving facilities, livelihoods and living conditions under "build back better" (psychological first aid, repairing or rebuilding damaged classrooms, education continuity plans).

What each app will do is not known yet; each will likely hold its own CRUD management. To keep the IRS intact, the pillars will be **separate web apps**. For now the IRS only links to them, through placeholder pages.

---

## 2. Requirements & User Stories

- **As an admin or super admin**, I want the four pillars in the sidebar so I can see where the new apps will live.
- **As the team**, we want the pillar pages kept apart from the IRS, so building them later doesn't touch the IRS.

Acceptance criteria:

- [x] A "DRRM pillars" group at the bottom of the admin nav: Prevention, Preparedness, Response, Recovery. Shown to administrators and super admins.
- [x] Each opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`), marked with an ↗ icon and "(opens in a new tab)" for screen readers.
- [x] Sidebar on web, rail on tablet (set apart by a rule), the More sheet on phone (with group titles).
- [x] Each pillar has a placeholder page outside the IRS shell: its name and summary, a "Coming soon" note, the example activities, and links between the four pillars.
- [x] Placeholder pages are for signed-in admins only. Unknown pillar slugs return 404.
- [x] Light and dark mode.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- None. The pillar apps will have their own data when they're planned.

### Server Actions & Data Flow

- None.

### UI & User Interaction

- `src/lib/pillars.ts`: `PILLARS` (slug, full name, sidebar label, rail label, icon, summary, example activities) and `pillarHref(slug)`. **When a pillar app exists, point `pillarHref` (or that pillar's href) at it**; the nav and placeholder pages follow.
- `(admin)/_components/shell/nav.ts`: the pillars are appended to the nav as `newTab` items, the first starting the "DRRM pillars" group.
- `(admin)/_components/shell/admin-shell.tsx`: `newTab` items get `target="_blank"` and `rel`, plus the ↗ icon (sidebar, More sheet) and a screen reader note. The rail draws a rule before the pillars. The More sheet now shows group titles (Manage, DRRM pillars) and scrolls if taller than the screen.
- `src/app/(pillars)/`: a route group with no IRS shell, behind `ProtectedRoute` (like the print report). `pillars/[pillar]/page.tsx` is a server component with `generateStaticParams` and `dynamicParams = false`, so the four pages are prerendered and other slugs 404. Header: logo, "DRRM pillars · preview" and an "IRS dashboard" button.

---

## 4. Implementation Tasks

- [x] Task 1: Pillar config.
- [x] Task 2: Nav items opening in a new tab (sidebar, rail, More sheet).
- [x] Task 3: Placeholder pages.
- [x] Task 4: Responsive & theme check (light/dark).

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`, `npm run type-check`, `npm run build`: pass; the four `/pillars/*` pages are prerendered.
- [x] Headless Chrome through temporary preview routes (deleted): sidebar at 1280 (light and dark), rail at 900, More sheet at 390 and 320 (dark), placeholder page at 1280 (light) and 390 (dark). All eight pillar links have `target="_blank"`, `rel="noopener noreferrer"` and the right href. No horizontal overflow.

Rollout: deploy. Nothing to run in Supabase.

Open items:

- [ ] Plan each pillar app: users and roles, records, and whether it shares the IRS Supabase project (auth, campuses, users) or gets its own.
- [ ] Decide where the apps are hosted, then point `pillarHref` at them. The placeholder pages and the `(pillars)` route group can then be removed.
- [ ] The example activities come from the national (DepEd) framework; replace them with the DRRM-H office's own scope once it's set.
