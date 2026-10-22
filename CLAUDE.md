# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Centralized admin web dashboard (Next.js) for the UPM DRRM-H Incident Reporting System, backed by Supabase (PostgreSQL). Field teams and bystanders submit reports directly through the web app (including QR-accessible public forms); admins manage events/drills, view field reports and headcounts, manage users, and configure lookup tables (clusters, units, positions, etc.); ERT members also run MATATAG building assessments. See `README.md` for the full ER diagram, use-case diagrams, and feature list.

## Project knowledge

`docs/` is an Obsidian vault. Start with `docs/00-index.md`, then read ONLY the notes for your task:

| Before touching…                                                      | Read                                                                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A server action, a hook, a campus filter, the Prisma/Supabase clients | `docs/architecture.md`                                                             |
| Sign-in, the profile, roles, profile setup                            | `docs/modules/auth.md`                                                             |
| A page, a route group, a guard, the admin shell                       | `docs/modules/routes.md`                                                           |
| Offline submits, IndexedDB, the service worker, `next.config.ts`      | `docs/modules/offline-pwa.md`                                                      |
| The MATATAG assessment (ERT form, admin pages, checklist editor)      | `docs/modules/assessments.md` (then `assessment-admin.md` / `checklist-editor.md`) |
| The dashboard's Building safety section, score arithmetic, charts     | `docs/modules/building-safety.md`                                                  |
| Settings or a lookup table                                            | `docs/modules/settings-lookups.md`                                                 |
| `schema.prisma`, `prisma/manual/*.sql`, seeds, Prisma config          | `docs/modules/database.md`                                                         |
| Styling, theme tokens, forms, Prettier, writing docs                  | `docs/conventions.md`                                                              |
| Anything else (events, reports, users, bystander reports, print, …)   | its note in `docs/modules/`, listed in `docs/00-index.md`                          |

## Commands

```bash
npm run dev          # Start dev server
npm run build         # Production build (next build --webpack — required by next-pwa, don't switch to turbopack)
npm run lint          # ESLint on src/**/*.{ts,tsx}
npm run lint:fix      # ESLint --fix
npm run type-check    # tsc --noEmit
npm run seed           # Seed lookup data (tsx prisma/seed.ts)
npm run seed:matatag   # Seed the MATATAG checklist (idempotent; matches by code, never deletes, item ids stay stable)
npm run test           # node:test via tsx: src/**/*.test.ts and prisma/**/*.test.ts
npx prisma generate    # Regenerate Prisma client (also runs automatically via postinstall)
```

## NEVER run

> **IMPORTANT / DISALLOWED COMMANDS:**
> Do NOT execute destructive or direct database modification commands:
>
> - `npx prisma db push` (DISALLOWED)
> - `npx prisma migrate dev` (DISALLOWED)
> - `npx prisma migrate reset` (DISALLOWED)

Schema changes ship as idempotent SQL in `prisma/manual/<ticket>.sql` plus the matching `schema.prisma` edit. How to apply one (env, direct connection, the exact `db execute` command): `docs/modules/database.md`.

## Testing & verification

- Verify changes with `npm run lint`, `npm run type-check`, `npm run test`, and `npm run build`. `npm run test` covers the pure logic in `src/lib` (assessment, building safety, access, admin scope, offline queue, schemas) and the checklist data, not UI or server actions, and CI doesn't run it yet.
- CI (`.github/workflows/ci.yml`) runs on PRs/pushes to `main`: `npm ci` → `prisma generate` → `npm audit --audit-level=critical` → lint → type-check → build. Pre-commit hook (Husky) runs `lint-staged` (eslint --fix + prettier on staged files).
- To sign in while testing in a browser, use the test accounts (ERT Member, Administrator, Super Admin) listed in `test-accounts.local.md` at the repo root. It is gitignored and lives only on the developer's machine, so a fresh worktree may not have it — ask the user then, and never copy its contents into committed files.

## Core rules

- **Server actions only:** every DB read/write is a `'use server'` function in `src/actions/<domain>/index.ts` using `src/lib/prisma.ts`; components never call Prisma; mutations call `revalidatePath(...)` for the affected route(s).
- **Hooks:** `src/components/hooks/use-<domain>.ts` wraps the actions in TanStack Query; mutations invalidate the relevant query keys on success (see `use-events.ts`) — no manual refetching.
- **Three clients, don't mix them:** `src/lib/prisma.ts` (server, all data), `src/lib/supabase.ts` (browser, auth only), `src/lib/supabase-admin.ts` (server, service role, only what Prisma can't do).
- **Campus scope:** admin lists and the dashboard take the switcher's campus id (`useScopedCampusId`) — don't add per-page campus filters.
- **Lookup tables:** a new one extends `LOOKUPS` / `LookupTable` (`src/app/(admin)/settings/_components/` + `src/actions/settings`), not a bespoke CRUD page.
- **Bundled creates:** new-report data stays in one `createReport` call (casualties, missing persons, population counts nested), because the offline queue replays a single create payload.
- **Caller checks:** newer actions take the Supabase token (`getAccessToken()`) and verify it with `requireProfile` / `requireAdmin` (`src/lib/server-auth.ts`), never trust a client-sent user id, and return expected failures as `{ ok: false, error, retry }` instead of throwing.
- **Hands off:** never hand-edit the generated Prisma client (`npx prisma generate`, imported from `@prisma/client`); don't "fix" lint issues in the vendored `src/components/ui/map.tsx`.

## Conventions

- Path alias `@/*` → `src/*`. Prettier: single quotes, semicolons, 100 print width; Tailwind classes and imports are sorted by plugins — don't hand-order them.
- Forms: Zod schemas in `src/lib/schemas.ts`, with `react-hook-form` + `@hookform/resolvers`.
- Theme tokens, no `dark:` variants: `bg-canvas` pages, `bg-surface` (not `bg-white`) cards/bars/drawers/inputs, `border-line` hairlines, `bg-brand-solid` maroon fills with white text; `data-theme="light"` keeps a subtree light. Detail: `docs/conventions.md`.

## Documentation & Planning Workflow

All non-trivial tasks, reviews, bug analyses, and feature specifications must be documented under `docs/` (plans in `docs/plan/{review,fix,bugs,feature}/`, described in `docs/README.md`).

- Use kebab-case with ticket/date prefixes (e.g. `docs/plan/fix/DRRM-003-report-form-atomicity.md` or `docs/plan/review/2026-09-08-dev-branch-audit.md`).
- Use standardized headers: `- **Status:** [Draft | In Review | Approved | In Progress | Done]`, plus the plan frontmatter described in `docs/conventions.md`.
- Map git branches 1:1 to their plan file (e.g. branch `feat/DRRM-015-...` ↔ `docs/plan/feature/DRRM-015-...`).
- Templates for new docs are available at `docs/plan/{review,bugs,fix,feature}/TEMPLATE.md` and `docs/decisions/TEMPLATE.md`.
- After a task, update the related `docs/modules` note (and its `updated` date).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
