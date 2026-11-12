---
type: module
updated: 2026-11-12
module: campus-scoping
paths:
  - src/actions/campus-table
  - src/app/(admin)/campus
  - src/app/(admin)/_components/shell/campus-switcher.tsx
  - src/app/(admin)/_components/shell/nav.ts
  - src/store/campus-scope.store.ts
  - src/lib/admin-scope.ts
  - src/components/hooks/use-campus.ts
tags: [module]
---

# Campus scoping

How the admin dashboard limits what it shows to one campus, and the Campus pages where Super Admins manage campuses. An Administrator is locked to the campus on their profile. A Super Admin picks a campus (or All campuses) in the top-bar switcher, and every admin list and the dashboard follow it. Assessment and building-safety actions repeat the rule on the server with `adminScope`.

**Related:** [[architecture]] · [[auth]] · [[users]] · [[dashboard]] · [[events]] · [[assessment-admin]] · [[building-safety]] · [[settings-lookups]]

## Where it lives

| Path                                                    | What it holds                                                                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/store/campus-scope.store.ts`                       | `useCampusScopeStore`: `campusId` (`''` = All campuses), persisted as `irs-admin-campus`                                         |
| `src/app/(admin)/_components/shell/campus-switcher.tsx` | `useIsSuperAdmin`, `useScopedCampusId`, `useEventTitle`, `CampusSwitcher`, `CampusLabel`                                         |
| `src/app/(admin)/_components/shell/admin-shell.tsx`     | `CampusScopeGate`; top bar shows `CampusSwitcher` or `CampusLabel`                                                               |
| `src/app/(admin)/_components/shell/nav.ts`              | `SUPER_ADMIN_HREFS = ['/campus', '/assessments/checklist']`, `navFor(isSuperAdmin)`                                              |
| `src/lib/admin-scope.ts`                                | `adminScope(profile, requestedCampusId)`, `inScope(scope, campusId)` (tests in `admin-scope.test.ts`)                            |
| `src/actions/campus-table/index.ts`                     | Campus CRUD and the clusters of a campus                                                                                         |
| `src/components/hooks/use-campus.ts`                    | Query hooks for campuses and campus clusters                                                                                     |
| `src/app/(admin)/campus/page.tsx`                       | `/campus`: campus cards in three sections (with events, set up, not set up), `CampusCard` with the latest event and its exports  |
| `src/app/(admin)/campus/details/page.tsx`               | `/campus/details?id=`: the campus hub: logo and backdrop, counts that link to the lists, the picked event's actions, its summary |
| `src/app/(admin)/campus/_components/campus-drawer.tsx`  | `CampusDrawer`: add / edit (logo, name, active) with `campusSchema`; `LogoField`, `CampusCard`, `campusStage` beside it          |

## Data

- `campus` (table `campus`, the model has no `@@map` and a lowercase name): `id`, `name`, `is_active`. Relations: `clusters`, `events`, `users`, `population_categories` (`CampusPopulationCategory`).
- Records carry the campus in two ways: directly (`User.campus_id`, `Event.campus_id`, `Cluster.campus_id`, `CampusPopulationCategory.campus_id`) or through their cluster (`Report.cluster` → `campus_id`, `bystander_reports.clusters` → `campus_id`). Buildings reach it through `unit` → `cluster`.
- Deleting a campus cascades to its `clusters` (and their `units`). `events` and `users` are `NoAction`, so a campus that still has them cannot be deleted.

## Server actions

`src/actions/campus-table/index.ts` (no caller check; the UI hides the pages from Administrators):

- `getCampuses()`: all campuses by name. Used by the switcher and many pickers.
- `getCampusesOverview()`: campuses with counts of events, users, clusters and active population categories, and `latestEvent` (an ongoing event, else the latest that started, else the newest; with its report count and `people`, the sum of its reports' population counts). Also feeds the dashboard's campus cards (DRRM-038).
- `getCampusOverview(id)`: one campus with the same counts plus `units`.
- `getCampusLogos()`: uploaded logos as public URLs `{ byId, byName }`. Reads `logo_path` with its own query and returns none if the column isn't there yet (before `prisma/manual/DRRM-036-campus-logo.sql`).
- `setCampusLogo(token, campusId, form | null)`: Super Admins only (`requireAdmin`, role `super_admin`). `logo` in the form (PNG or WebP, up to 1 MB; `logoProblem`) is uploaded to the public `campus-logos` bucket under `<campusId>/<uuid>.<ext>` (`src/lib/campus-logo-storage.ts`), then `logo_path` is set; no file removes it. The old file is deleted after the update; if the update fails, the new upload is. Returns `{ ok, url }` or `{ ok: false, error, retry }`.
- `createCampus(data)`, `updateCampus(id, data)`, `deleteCampus(id)`: errors through `toFriendlyError(err, 'campus')`; revalidate `/campus` (update also `/campus/details`).
- `getCampusClusters(campusId)`: `id`, `name`, `is_active` of the campus's clusters.

Scoped reads in other modules take the campus as an argument, for example `getUsers(query, campusId)`, `getEvents(query, campusId)`, `getOngoingEvents(campusId)`, `getBystanderReports(campusId)`, `getDashboard(campusId, …)`. They filter by `campus_id` or by `cluster: { campus_id }` and trust the value sent.

Server-checked scope: `requireAdmin(token, campusId)` in `src/lib/server-auth.ts` calls `adminScope`. A Super Admin gets the campus asked for (`''` or none → `null`, meaning all). An Administrator always gets their own `campus_id`, whatever was asked; without one they are refused. Everyone else is refused. Used by `src/actions/assessment-admin`, `src/actions/assessment-templates` and `src/actions/building-safety`.

## Client side

- `useScopedCampusId()`: Administrators get their profile `campus_id`. Super Admins get the store value; a remembered campus that no longer exists falls back to `''`.
- Pages pass that id to their hooks (`campusId || undefined` for "all"). Used on the dashboard, events, event details, reports, emergency reports, users, settings lookup tables and population fields, and the assessments tabs.
- `CampusSwitcher` lists All campuses plus active campuses, shows a skeleton until campuses load, and closes on Escape.
- `CampusScopeGate` redirects non-Super Admins away from `SUPER_ADMIN_HREFS` to `/dashboard`, and shows "No campus assigned" to an Administrator without a `campus_id`.
- `useEventTitle()` adds " — Campus" to event names for Super Admins only.
- Hooks: `useCampuses`, `useCampusesOverview`, `useCampusOverview(id)`, `useCreateCampus`, `useUpdateCampus`, `useDeleteCampus`, `useSetCampusLogo` (all invalidate `campuses`, `campus`, `campuses-overview`, `campus-overview`, `campus-logos`), `useCampusLogos` (10 min stale), `useCampusClusters(campusId)` (key `['cluster', campusId]`).
- Campus list (DRRM-036): "With events" (most events first, then by name; 80 px logos, 2 columns), "Set up, no events yet" (has population fields) and "Not set up yet" (keeps the warning), each with a count; rows share one height (`items-stretch`, `h-full`). `CampusCard`: the name links to the campus page and its link covers the card; the latest event box has Export PDF and NSED report (completed, where `nsedTemplateFor` has a template) or Open event while it is ongoing, above the link.
- Logos (DRRM-036): `campusLogo(name, uploaded)` / `ownCampusLogo(name, uploaded)` use the uploaded logo first, then the bundled `/public/up-<campus>-logo.png`, then the UP seal. `CampusMark` and `CampusBackdrop` read `useCampusLogos().byName`, as do the event PDF letterhead and the bystander form. `LogoField` (Add / Edit campus): a 112 px preview, Choose file / Replace / Remove and drag and drop; PNG, JPG or SVG, scaled in the browser to 512 × 512 keeping transparency (`scaleLogo`, WebP or PNG). The logo saves after the campus, so a logo problem never loses the campus.
- Campus page (DRRM-036): a 96 px logo (64 on phone) and `CampusBackdrop`; ⋯ holds Edit campus, Population fields and Delete campus. A row of counts (Events, Users, Clusters, Units, Population fields) links to those lists and sets the top-bar campus to this one first, so they open filtered. Under the Showing picker: Complete event (while ongoing, `CompleteEventDialog`), Export PDF, Export NSED report (where the template exists) and Open event details.

## Rules and gotchas

- A record with no campus (an off-campus account's building or assessment, DRRM-026) is in scope only for all campuses: `inScope(scope, null)` is true only when `scope.campusId` is null. So only a Super Admin on All campuses sees it, and an Administrator never does.
- Read the campus through `useScopedCampusId()`. Do not add a per-page campus filter.
- The client-side lock is the only guard for the older actions; a crafted request can read another campus. New admin actions should use `requireAdmin` so the server picks the campus.
- `''` means All campuses in the store and in `adminScope`. Convert it to `undefined` / `null` before passing it to a query.
- The dashboard's building-safety drill keeps its own campus in the `bs_campus` URL param and never moves the switcher (see [[building-safety]]).
- The `/campus` card warns when a campus has no active population fields ("ERT headcount has nothing to fill in").
- The store is per device and sign-out does not clear it, so the next Super Admin on the same browser starts on the last pick.
- The seed script puts every cluster and event on one hard-coded campus id (see [[database]]).

## Decisions

- [[0007-token-verified-actions]] `requireAdmin` + `adminScope` decide the campus on the server for the newer actions.
- [[0001-server-actions-only]] campus CRUD and scoped reads are server actions.
