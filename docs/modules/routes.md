---
type: module
module: routes
updated: 2026-11-12
verified: true
paths:
  - src/app
tags: [module]
---

# Routes and route groups

Every page lives under `src/app/` in a route group, and the group decides the frame and the guard: admin shell, ERT frame, print sheet or public page. Read this before adding a page, moving one between groups or changing who can open it.

**Related:** [[architecture]] · [[auth]] · [[campus-scoping]] · [[design-system]] · [[assessments]] · [[print]] · [[offline-pwa]]

## Essentials

- **`(admin)/`**: the protected dashboard pages (dashboard, events, reports, emergency-reports, users, settings, campus, assessments) in one shell, `(admin)/_components/shell`: a sidebar on web, an icon rail on tablet, bottom tabs on phone.
  - The layout wraps every page in `ProtectedRoute` and `ProfileSetupGate`.
  - The top-bar campus switcher (`useCampusScopeStore`, read through `useScopedCampusId`) scopes every list and the dashboard. Pass its campus id to queries instead of adding per-page campus filters ([[campus-scoping]]).
  - Shared pieces live in `(admin)/_components`: the list table that turns into cards on phone (`data-list.tsx`), drawer parts (`drawer-parts.tsx`), the confirm dialog (`confirm-dialog.tsx`), `page-header.tsx`, `charts/` and `summary/`.
  - `(admin)/_lib` holds status colours (`status.ts`), formatting (`format.ts`) and the event summary model (`summary.ts`), which campus details, event details and the report PDF use ([[events]]).
- **`/more`** (inside `(admin)/`): the phone More page, reached from the fifth bottom tab. It lists the pages that are not tabs, My profile, Appearance and Sign out; the pages it opens show a More back link on phone (see [[design-system]]).
- **`(print)/`**: pages laid out for A4 and saved as PDF from the print dialog, for signed-in admins, with no shell. The layout wraps them in `ProtectedRoute`.
  - `/events/report`: the event report ([[print]]).
  - `/assessments/report?id=`: one assessment, using the ERT `RecordPrint` ([[assessment-admin]]).
- **`(auth)/`**: `/signin`, `/forgot-password`, `/update-password`. They share the `AuthShell` frame ([[auth]]).
- **`(ert)/`**: the signed-in ERT pages.
  - Shared parts in `(ert)/_components`: `ErtFrame` (`frame.tsx`), `TopBar` (`top-bar.tsx`) with the Report | Assessment switch, the `chrome.tsx` blocks, and `waiting-to-send.tsx`.
  - Shared logic in `(ert)/_lib`. `useErtAccess` sends signed-out users to `/signin`, admins to `/dashboard`, and users with an incomplete profile to `ProfileSetup`.
  - `/home` is the landing chooser.
  - `/report` is the status report. Each user gets one report per ongoing event (`getMyReportForOngoingEvent`). After that, only missing persons and casualties can be edited, and only while the event is ongoing ([[field-reports]]).
  - `/assessment` is the building assessment: one route with `?draft=` / `?view=` / `?print=` ([[assessments]], [[0005-assessment-single-route]]).
- **`(public)/`**: the landing page `/` and the anonymous, QR-accessible bystander report form `/bystander-report`. No auth ([[pillars-and-landing]], [[bystander-reports]]).
- **`(pillars)/`**: `/pillars/[pillar]`, a placeholder page per DRRM pillar, reachable by URL (the admin sidebar no longer lists them since DRRM-037). The layout wraps it in `ProtectedRoute` ([[pillars-and-landing]]).
- **`auth/`**: `/auth/callback`, the OAuth callback. It is a client page, not a route handler ([[auth]]).
- **`~offline`**: the offline fallback page the service worker shows for an uncached page ([[offline-pwa]]).

## All pages

| URL                                                                                                      | File (`src/app/…/page.tsx`)                                  | Guard                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/dashboard`                                                                                             | `(admin)/dashboard`                                          | `ProtectedRoute` + `ProfileSetupGate`                                                                                                                              |
| `/events`, `/events/details`                                                                             | `(admin)/events`, `events/details`                           | same                                                                                                                                                               |
| `/reports`                                                                                               | `(admin)/reports`                                            | same                                                                                                                                                               |
| `/emergency-reports`                                                                                     | `(admin)/emergency-reports`                                  | same                                                                                                                                                               |
| `/users`                                                                                                 | `(admin)/users`                                              | same                                                                                                                                                               |
| `/campus`, `/campus/details`                                                                             | `(admin)/campus`, `campus/details`                           | `/campus` Super Admin only (`isSuperAdminPath`); `/campus/details` also opens to an Administrator for their own campus only, read-only (another id goes to theirs) |
| `/settings/{clusters,units,buildings,positions,casualty-conditions,damage-conditions,population-fields}` | `(admin)/settings/<tab>` (`/settings` redirects to clusters) | same                                                                                                                                                               |
| `/assessments`, `/assessments/details?id=`                                                               | `(admin)/assessments`, `assessments/details`                 | same                                                                                                                                                               |
| `/assessments/checklist`                                                                                 | `(admin)/assessments/checklist`                              | same, plus Super Admin only (`isSuperAdminPath` in `shell/nav.ts`)                                                                                                 |
| `/events/report`, `/assessments/report?id=`                                                              | `(print)/events/report`, `(print)/assessments/report`        | `ProtectedRoute`                                                                                                                                                   |
| `/pillars/[pillar]`                                                                                      | `(pillars)/pillars/[pillar]`                                 | `ProtectedRoute`                                                                                                                                                   |
| `/home`, `/report`, `/assessment`                                                                        | `(ert)/home`, `(ert)/report`, `(ert)/assessment`             | `useErtAccess` (per page)                                                                                                                                          |
| `/signin`, `/forgot-password`, `/update-password`                                                        | `(auth)/…`                                                   | none                                                                                                                                                               |
| `/`, `/bystander-report`                                                                                 | `(public)`, `(public)/bystander-report`                      | none                                                                                                                                                               |
| `/auth/callback`                                                                                         | `auth/callback`                                              | none                                                                                                                                                               |
| `/~offline`                                                                                              | `~offline`                                                   | none                                                                                                                                                               |

## Rules and gotchas

- Admin vs. non-admin is decided by `isAdminUserType()` (`src/lib/constants.ts`). `ProtectedRoute` sends non-admins to `/home` without mounting the page, and `useErtAccess` sends admins to `/dashboard` ([[auth]]).
- ERT pages that must work offline avoid dynamic segments, because the service worker might not have cached them. The `ert-pages` cache rule in `next.config.ts` ignores the query string ([[offline-pwa]]).
- The `(print)` pages and `?print=` render without a shell or `ErtFrame`, but keep their guard.
- A new admin page goes in `navFor` in `(admin)/_components/shell/nav.ts`. A Super-Admin-only page also goes in `isSuperAdminPath` (today `/campus`, exactly, and `/assessments/checklist`), which `CampusScopeGate` blocks for Administrators.
- Navigation (DRRM-037), campus first. `navFor(isSuperAdmin, ownCampus)` in `shell/nav.ts` (through `useNav()`): Dashboard; the Campuses group: for Super Admins the campuses with events (`useSidebarCampuses`: from `useCampusesOverview`, most events first then by name, a 22 px `CampusMark`, a green Live dot when the latest event is ongoing; each opens `/campus/details?id=`) and then All campuses with the campus count (`/campus`); for Administrators only their own campus (its page, `activePath` `/campus/details`); Records (Events, Reports, Bystander reports with the pending badge, Assessments); Manage (Users, Settings). The DRRM pillars left the nav; their pages stay reachable by URL. The tablet rail shows the same campuses as logos with short names. Phone tabs: Home, Campuses (Campus for Administrators), Events, Bystander, More; Reports moved to More under Records.

## Decisions

- [[0005-assessment-single-route]] the assessment uses query params, not a dynamic segment.
- [[0003-webpack-build-for-pwa]] the service worker that caches these pages is generated by the webpack build.
