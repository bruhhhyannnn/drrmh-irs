---
type: reference
tags: [architecture]
---

# Architecture

The UPM DRRM-H Incident Reporting System is one Next.js 16 app (App Router) on Supabase. Supabase gives Postgres and Auth. ERT members file field reports and building assessments from their phones, bystanders file reports through a public QR form, and admins run events, read reports and manage the lookup tables. Diagrams of the ER model and use cases are in the repo `README.md` (outside this vault).

**Related:** [[00-index]] · [[conventions]] · [[glossary]] · [[data-layer]]

## Users and where they land

| Who           | Signs in?                      | Lands on                                   | Route group                                                  |
| ------------- | ------------------------------ | ------------------------------------------ | ------------------------------------------------------------ |
| Bystander     | No                             | `/`, `/bystander-report`                   | `(public)/` → [[bystander-reports]], [[pillars-and-landing]] |
| ERT Member    | Google (`@up.edu.ph`) or email | `/home` → `/report`, `/assessment`         | `(ert)/` → [[field-reports]], [[assessments]]                |
| Administrator | yes                            | `/dashboard` (own campus only)             | `(admin)/`                                                   |
| Super Admin   | yes                            | `/dashboard` (any campus, campus switcher) | `(admin)/`, plus `/assessments/checklist`                    |

Admin vs. non-admin is decided only by `isAdminUserType()` in `src/lib/constants.ts`. See [[auth-and-profiles]].

## Layers

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
  └─ src/lib/supabase-admin.ts  service-role client (Auth admin API only)
```

- **Data access goes through server actions only** ([[0001-server-actions-only]]). Components never import Prisma. Mutations call `revalidatePath(...)`, and hooks invalidate their query keys on success.
- **Three ways in, kept apart:** `src/lib/prisma.ts` (server, all data), `src/lib/supabase.ts` (browser, auth and Realtime only), `src/lib/supabase-admin.ts` (server, privileged Auth calls). Details in [[data-layer]].
- **Pure logic sits in `src/lib`** with `node:test` tests next to it (assessment scoring, building safety pooling, admin scope, offline flush, schemas). The UI and server actions have no tests.

## Route groups (`src/app/`)

| Group           | What                                                                                | Notes                                                              |
| --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `(public)/`     | landing page, bystander form                                                        | no auth → [[pillars-and-landing]], [[bystander-reports]]           |
| `(auth)/`       | sign-in, forgot/update password                                                     | `AuthShell` frame → [[auth-and-profiles]]                          |
| `auth/callback` | OAuth callback route                                                                |                                                                    |
| `(ert)/`        | `/home`, `/report`, `/assessment`                                                   | `useErtAccess` guard → [[field-reports]], [[assessments]]          |
| `(admin)/`      | dashboard, events, reports, emergency-reports, users, settings, campus, assessments | one shell, campus switcher → [[campus-scoping]], [[design-system]] |
| `(print)/`      | `/events/report`, assessment reports on A4                                          | no shell → [[print]]                                               |
| `(pillars)/`    | placeholder page per DRRM pillar                                                    | → [[pillars-and-landing]]                                          |
| `~offline`      | offline fallback page                                                               | → [[offline-pwa]]                                                  |

## Cross-cutting pieces

- **Auth:** Supabase Auth is the identity provider. The `users` table holds the profile, linked by `auth_id`. `AuthProvider` loads the profile into the auth store, and `ProfileSetupGate` blocks non-admins until campus, cluster, unit and position are set. → [[auth-and-profiles]]
- **Campus scoping:** the top-bar switcher (`useCampusScopeStore` / `useScopedCampusId`) scopes every admin list. Administrators are locked to their own campus. The newer assessment actions decide the campus on the server (`adminScope`). → [[campus-scoping]], [[0007-token-verified-actions]]
- **Offline / PWA:** next-pwa service worker (production only) and an IndexedDB queue for new field reports, bystander reports and assessments, replayed on `online`, on mount and every 45 s. → [[offline-pwa]], [[0003-webpack-build-for-pwa]], [[0004-offline-queue-bundled-create]]
- **Lookup tables:** one generic implementation for clusters, units, positions and the rest. → [[settings-lookups]], [[0009-table-driven-settings]]
- **MATATAG assessments:** a versioned checklist template in the DB, scored per DRRM pillar, rolled up on the dashboard. → [[assessments]], [[assessment-admin]], [[checklist-editor]], [[building-safety]], [[0005-assessment-single-route]], [[0006-versioned-checklist-template]]
- **Theme:** tokens in `globals.css` that switch under `.dark`. A4 sheets stay light. → [[design-system]]

## Build and run

`npm run build` is `next build --webpack` (next-pwa needs webpack). CI on PRs to `main` runs `npm ci` → `prisma generate` → `npm audit --audit-level=critical` → lint → type-check → build. `npm run test` runs locally only. See [[conventions]].
