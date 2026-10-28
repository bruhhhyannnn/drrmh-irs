---
type: reference
updated: 2026-10-28
verified: true
tags: [architecture]
---

# Architecture

Read this before adding a server action, a hook, a query that filters by campus, or anything that talks to Postgres or Supabase.

**Related:** [[00-index]] · [[conventions]] · [[glossary]] · [[database]] · [[routes]] · [[auth]] · [[campus-scoping]]

## Project

This is the centralized admin web dashboard (Next.js) for the UPM DRRM-H Incident Reporting System, backed by Supabase (PostgreSQL).

- **Field teams (ERT members) and bystanders** submit reports directly through the web app. Bystanders use QR-accessible public forms.
- **Admins** manage events and drills, view field reports and headcounts, manage users, and configure lookup tables (clusters, units, positions and the rest).
- **ERT members** also file MATATAG building assessments ([[assessments]]).

The repo's `README.md` (outside this vault) has the full ER diagram, the use-case diagrams and the feature list.

## Users and where they land

| Who           | Signs in?                      | Lands on                                   | Route group                                                  |
| ------------- | ------------------------------ | ------------------------------------------ | ------------------------------------------------------------ |
| Bystander     | No                             | `/`, `/bystander-report`                   | `(public)/` → [[bystander-reports]], [[pillars-and-landing]] |
| ERT Member    | Google (`@up.edu.ph`) or email | `/home` → `/report`, `/assessment`         | `(ert)/` → [[field-reports]], [[assessments]]                |
| Administrator | yes                            | `/dashboard` (own campus only)             | `(admin)/`                                                   |
| Super Admin   | yes                            | `/dashboard` (any campus, campus switcher) | `(admin)/`, plus `/campus` and `/assessments/checklist`      |

Admin vs. non-admin is decided only by `isAdminUserType()` in `src/lib/constants.ts` ([[auth]]). Every route group and page is listed in [[routes]].

## Data flow

```text
Browser
  ├─ pages:     src/app/<route group>/...           (React, client components)
  ├─ hooks:     src/components/hooks/use-<domain>.ts (TanStack Query around server actions)
  ├─ stores:    src/store/*                          (Zustand: auth, campus scope, offline queue, theme, language)
  └─ offline:   src/lib/offline-queue.ts             (IndexedDB queues + drafts + cache)
        │  server action call (POST)
        ▼
Server  src/actions/<domain>/index.ts ('use server')
  ├─ src/lib/prisma.ts          Prisma client via @prisma/adapter-pg   → Postgres
  ├─ src/lib/server-auth.ts     requireProfile / requireAdmin (token checks)
  └─ src/lib/supabase-admin.ts  service-role client (Auth admin API, Storage)
```

- **Data access goes through server actions only** ([[0001-server-actions-only]]).
  - Every DB read and write is a `'use server'` function in `src/actions/<domain>/index.ts`, using the Prisma client from `src/lib/prisma.ts`.
  - Components never call Prisma directly.
  - Mutations that change data call `revalidatePath(...)` for the affected routes.
- **Client data flow:** `src/components/hooks/use-<domain>.ts` wraps each domain's server actions in TanStack Query (`useQuery` / `useMutation`). There is one hook file per domain: events, users, reports, settings, campus, dashboard, bystander-reports, population-categories, assessments, assessment-templates. `use-debounced.ts` sits in the same folder but is a utility, not a domain. Mutations invalidate the relevant query keys on success. Follow that pattern (see `use-events.ts`) instead of refetching by hand.
- **Caller checks:** the older actions trust the user and campus ids the client sends. Newer actions take the Supabase access token and verify it on the server (`requireProfile(token)` / `requireAdmin(token, campusId)` in `src/lib/server-auth.ts`). They return expected failures as `{ ok: false, error, retry }` instead of throwing, because thrown messages are hidden in production ([[0007-token-verified-actions]]).
- **Pure logic sits in `src/lib`**, with `node:test` tests next to it: access, admin scope, assessment caller, draft, score and template, building safety, offline cache and flush, and schemas. The NSED report's builder and template fill are tested next to them in `src/app/(admin)/_lib/nsed-report.test.ts`. The checklist data test is `prisma/data/matatag-2025-07-25.test.ts`. The UI and server actions have no tests.

## The three clients (don't mix them up)

There are two Prisma/Postgres access paths and one Supabase path:

- **`src/lib/prisma.ts`:** the server-side Prisma client (through `@prisma/adapter-pg`), used from server actions for all the admin dashboard's reads and writes ([[database]]).
- **`src/lib/supabase.ts`:** the browser Supabase SDK. It is used for **auth only** (`AuthProvider`, sign-in and sign-out, `getAccessToken()`), and for Supabase Realtime subscriptions if any are added. None exist today.
  - The key it uses is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, Supabase's publishable key. The older `CLAUDE.md` called it the "anon key".
- **`src/lib/supabase-admin.ts`:** the server-side Supabase client with the service role key. It is only for privileged operations Prisma can't do: the Supabase Auth admin API (create and delete users, verifying tokens in `requireProfile`), and the private `bystander-photos` Storage bucket.

## Campus scoping

- **Scoped columns:** most domain models are scoped by `campus_id` / `cluster_id`. `users` has both, `clusters` has `campus_id`, and `reports` and `bystander_reports` have `cluster_id`. Before adding a query, check how existing actions filter, e.g. `getOngoingEvents(campusId)` in `src/actions/events`.
- **The switcher:** the admin top-bar campus switcher (`useCampusScopeStore`, read through `useScopedCampusId`) scopes every admin list and the dashboard. Pass its campus id to queries instead of adding per-page campus filters ([[campus-scoping]]).
- **Server-side campus:** token-verified admin actions (`assessment-admin`, `assessment-templates`, `building-safety`) decide the campus on the server with `adminScope` (`src/lib/admin-scope.ts`). An Administrator gets their own campus whatever the request says, and a Super Admin the one asked for (or all).

## Cross-cutting pieces

- **Auth:** Supabase Auth plus the `users` profile, the setup gate and role checks → [[auth]]
- **Offline / PWA:** the next-pwa service worker (production only) and the IndexedDB queues → [[offline-pwa]], [[0003-webpack-build-for-pwa]], [[0004-offline-queue-bundled-create]]
- **Lookup tables:** one generic implementation → [[settings-lookups]], [[0009-table-driven-settings]]
- **MATATAG assessments:** a versioned checklist template, scored per DRRM pillar and rolled up on the dashboard → [[assessments]], [[assessment-admin]], [[checklist-editor]], [[building-safety]]
- **Theme:** tokens in `globals.css` that switch under `.dark`, while A4 sheets stay light → [[conventions]], [[design-system]]

## Build and CI

`npm run build` is `next build --webpack`, because next-pwa needs webpack. CI (`.github/workflows/ci.yml`) runs on PRs and pushes to `main`: `npm ci` → `prisma generate` → `npm audit --audit-level=critical` → lint → type-check → build. `npm run test` is commented out in CI, so it only runs locally.
