# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Centralized admin web dashboard (Next.js) for the UPM DRRM-H Incident Reporting System, backed by Supabase (PostgreSQL). Field teams and bystanders submit reports directly through the web app (including QR-accessible public forms); admins manage events/drills, view field reports and headcounts, manage users, and configure lookup tables (clusters, units, positions, etc.). See `README.md` for the full ER diagram, use-case diagrams, and feature list.

## Commands

```bash
npm run dev          # Start dev server
npm run build         # Production build
npm run lint          # ESLint on src/**/*.{ts,tsx}
npm run lint:fix      # ESLint --fix
npm run type-check    # tsc --noEmit
npm run seed           # Seed lookup data (tsx prisma/seed.ts)
npx prisma generate    # Regenerate Prisma client (also runs automatically via postinstall)
```

> **IMPORTANT / DISALLOWED COMMANDS:**
> Do NOT execute destructive or direct database modification commands:
>
> - `npx prisma db push` (DISALLOWED)
> - `npx prisma migrate dev` (DISALLOWED)
> - `npx prisma migrate reset` (DISALLOWED)

There is no test suite configured (`npm run test` is commented out in CI). Verify changes with `npm run lint`, `npm run type-check`, and `npm run build`.

CI (`.github/workflows/ci.yml`) runs on PRs/pushes to `main`: `npm ci` → `prisma generate` → `npm audit --audit-level=critical` → lint → type-check → build. Pre-commit hook (Husky) runs `lint-staged` (eslint --fix + prettier on staged files).

## Architecture

**Data access is server-actions-only.** Every DB read/write goes through a `'use server'` function in `src/actions/<domain>/index.ts` using the Prisma client from `src/lib/prisma.ts`. Components never call Prisma directly. Mutations that change data call `revalidatePath(...)` for the affected route(s).

**Client data flow:** `src/components/hooks/use-<domain>.ts` wraps each domain's server actions in TanStack Query (`useQuery`/`useMutation`), one hook file per domain (events, users, reports, settings, campus). Mutations invalidate the relevant query keys on success — follow this pattern (see `use-events.ts`) rather than manual refetching.

**Two Prisma/Postgres access paths + one Supabase path, don't mix them up:**

- `src/lib/prisma.ts` — server-side Prisma client (via `@prisma/adapter-pg`), used from server actions for all admin-dashboard reads/writes.
- `src/lib/supabase.ts` — client-side Supabase SDK (anon key), used for **auth only** (`AuthProvider`, sign-in/out) and any Supabase Realtime subscriptions.
- `src/lib/supabase-admin.ts` — server-side Supabase client (service role key), for privileged operations Prisma can't do (e.g. Supabase Auth admin API).

**Auth flow:** Supabase Auth (Google OAuth restricted to `@up.edu.ph` emails) is the identity provider; `users` table (Prisma) holds the app profile, linked via `auth_id`. `AuthProvider` (`src/components/auth/auth-provider.tsx`) listens to `supabase.auth.onAuthStateChange`, then loads the profile via `getUserByAuthId` server action into `useAuthStore` (Zustand). New Google sign-ins are provisioned into `users` by `provisionGoogleUser` (`src/actions/auth`), defaulting to the "ERT Member" user type. `ProtectedRoute` gates admin pages by role.

**Route groups** under `src/app/`:

- `(admin)/` — protected dashboard pages (dashboard, events, reports, emergency-reports, users, calendar, settings, campus)
- `(auth)/` — sign-in
- `(ert)/` and `(public)/` — ERT member and public-facing pages (e.g. QR-accessible incident/bystander report submission), not behind admin auth
- `auth/` — OAuth callback route

**Settings pages are generic/table-driven.** The many lookup tables (clusters, units, locations, positions, user types, event statuses, casualty/damage conditions) share one implementation: `src/components/settings/settings-table-page.tsx` + `src/actions/settings`. When adding a new lookup table, extend this generic pattern instead of writing a bespoke CRUD page.

**Multi-campus/cluster scoping:** most domain models (`users`, `reports`, `bystander_reports`, `clusters`) are scoped by `campus_id`/`cluster_id`. Check existing action functions (e.g. `getOngoingEvent(campusId)`) for the expected filtering pattern before adding new queries.

**Prisma schema** (`prisma/schema.prisma`) uses `snake_case` DB columns/tables (`@map`/`@@map`) with PascalCase Prisma model names — e.g. model `User` maps to table `users`. IDs are DB-generated UUIDs (`dbgenerated("gen_random_uuid()")`). The generated client is emitted to `src/generated/` — never hand-edit it.

**Prisma config** lives in `prisma.config.ts` (not `package.json`), using `DATABASE_URL` and `SHADOW_DATABASE_URL`.

## Conventions

- Path alias `@/*` → `src/*`.
- Prettier: single quotes, semicolons, 100 print width, Tailwind class sorting and import organizing run automatically via `prettier-plugin-tailwindcss` / `prettier-plugin-organize-imports` — don't hand-order imports or Tailwind classes.
- `src/components/ui/map.tsx` is vendored (from mapcn) and excluded from linting — don't "fix" lint issues there.
- Zod schemas for forms live in `src/lib/schemas.ts`; forms use `react-hook-form` + `@hookform/resolvers`.

## Documentation & Planning Workflow

All non-trivial tasks, reviews, bug analyses, and feature specifications must be documented under `docs/`:

```text
docs/
├── README.md       # Docs workflow overview & guidelines
└── plan/
    ├── review/     # Code audits, PR reviews, security & performance findings
    ├── fix/        # Step-by-step resolution & refactor execution plans
    ├── bugs/       # Bug reports, reproduction steps & root-cause analyses (RCA)
    └── feature/    # Feature specifications, RFCs & task breakdowns
```

**Conventions:**

- Use kebab-case with ticket/date prefixes (e.g. `docs/plan/fix/DRRM-003-incident-fix.md` or `docs/plan/review/2026-09-08-dev-branch-audit.md`).
- Use standardized headers: `- **Status:** [Draft | In Review | Approved | In Progress | Done]`.
- Map git branches 1:1 to their plan file (e.g. branch `bugfix/DRRM-003-...` ↔ `docs/plan/fix/DRRM-003-...`).
- Templates for new docs are available at `docs/plan/{review,bugs,fix,feature}/TEMPLATE.md`.
