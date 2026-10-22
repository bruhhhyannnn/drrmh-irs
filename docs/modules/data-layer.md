---
type: module
module: data-layer
paths:
  - prisma/schema.prisma
  - prisma/manual
  - prisma/seed.ts
  - prisma.config.ts
  - src/lib/prisma.ts
  - src/lib/supabase.ts
  - src/lib/supabase-admin.ts
  - src/lib/prisma-error.ts
  - src/lib/schemas.ts
tags: [module]
---

# Data layer

The Postgres schema (Prisma 7 on Supabase), how it changes, how it is seeded, and the three clients that talk to Supabase. Every module reads and writes through server actions that use the Prisma client here. Developers touch this module; no end user sees it directly.

**Related:** [[architecture]] · [[conventions]] · [[auth-and-profiles]] · [[campus-scoping]] · [[settings-lookups]] · [[assessments]] · [[checklist-editor]]

## Where it lives

| Path                                     | What it holds                                                                                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`                   | All models and enums; generator `prisma-client-js` with no `output`                                                                                                                   |
| `prisma/manual/*.sql`                    | Idempotent schema changes, one file per ticket: `DRRM-008-bystander-report-v2.sql`, `DRRM-011-super-admin-v2.sql`, `DRRM-015-assessment.sql`                                          |
| `prisma/migrations/`                     | One old migration (`20260505010152_add_report_verification`); it still creates tables the schema no longer has (`report_assignments`, `activity_logs`, `locations`, `report_damages`) |
| `prisma/seed.ts`                         | `npm run seed`: lookup tables, NSED events per quarter, sample reports                                                                                                                |
| `prisma/seed-matatag.ts`, `prisma/data/` | `npm run seed:matatag`: the MATATAG checklist (see [[assessments]])                                                                                                                   |
| `prisma.config.ts`                       | Schema path, migrations path, seed command, `DATABASE_URL`, `SHADOW_DATABASE_URL`; loads `.env` via `dotenv/config`                                                                   |
| `src/lib/prisma.ts`                      | `prisma`: `PrismaClient` with `PrismaPg` adapter on `DATABASE_URL`, cached on `globalThis` outside production                                                                         |
| `src/lib/supabase.ts`                    | `supabase` browser client (publishable key, persisted session) and `getAccessToken()`                                                                                                 |
| `src/lib/supabase-admin.ts`              | `supabaseAdmin` with `SUPABASE_SERVICE_ROLE_KEY` (server only)                                                                                                                        |
| `src/lib/prisma-error.ts`                | `toFriendlyError(error, label)`                                                                                                                                                       |
| `src/lib/schemas.ts`                     | Zod schemas and form types for every form                                                                                                                                             |

## Data

Models by domain (model, table in parentheses):

- People: `User` (`users`), `UserType` (`user_types`), `Position` (`positions`).
- Places: `campus` (`campus`), `Cluster` (`clusters`, unique `name`), `Unit` (`units`, unique `name` + `cluster_id`).
- Events: `Event` (`events`, `campus_id`, `status_id`, `user_id` creator, `completed_by`), `EventStatus` (`event_statuses`).
- Field reports: `Report` (`reports`: `event_id`, `cluster_id`, `unit_id`, legacy headcount int columns, `damage_condition_id`, location), `ReportCasualty` (`report_casualties`), `ReportMissingPerson` (`report_missing_persons`), `ReportPopulationCount` (`report_population_counts`, unique `report_id` + `category_id`).
- Bystander reports: `bystander_reports` (`contact_number`, `photo_paths`), `bystander_incident_types`, `bystander_report_statuses`, `BystanderReportPopulationCount` (`bystander_report_population_counts`). Casualties and missing persons reuse `ReportCasualty` / `ReportMissingPerson` through `bystander_report_id`.
- Lookups: `CasualtyCondition` (`casualty_conditions`), `DamageCondition` (`damage_conditions`), `PopulationCategory` (`population_categories`), `CampusPopulationCategory` (`campus_population_categories`).
- Assessments: enums `AssessmentAnswer` (yes/no/na), `AssessmentSafeAnswer`, `AssessmentVersionStatus` (draft/published/retired); `DrrmPillar` (`drrm_pillars`), `BuildingAreaType` (`building_area_types`), `AssessmentTemplate`, `AssessmentTemplateVersion`, `AssessmentSection`, `AssessmentItem`, `Building` (`buildings`), `BuildingArea`, `Assessment` (`assessments`, unique `client_ref`), `AssessmentArea`, `AssessmentAnswerRow` (`assessment_answers`), `AssessmentPillarScore`, `AssessmentSectionComment`.

All ids are `uuid` with `dbgenerated("gen_random_uuid()")`. Columns are `snake_case`; most models are PascalCase with `@@map`, but `campus` and the `bystander_*` models keep the table name as the model name.

## Server actions

None live here. Every module's `src/actions/<domain>/index.ts` imports `prisma` from `src/lib/prisma.ts`. `toFriendlyError` turns `P2003` (still in use), `P2002` (already exists) and `P2025` (not found) into readable messages; actions call it as `toFriendlyError(err, '<label>')`.

`supabaseAdmin` is used for `auth.admin.createUser` / `deleteUser` ([[users]]), `auth.getUser(token)` (`requireProfile`, [[auth-and-profiles]]) and the private `bystander-photos` Storage bucket (`src/lib/bystander-photos.ts`, [[bystander-reports]]).

## Client side

- The browser never imports `prisma`. It uses `supabase` from `src/lib/supabase.ts` for auth only, and `getAccessToken()` to pass the token to token-verified actions.
- Forms use `react-hook-form` with `zodResolver` and the schemas in `src/lib/schemas.ts` (sign-in and password, user, event, report and casualty, bystander report, cluster, unit, building, position, campus, conditions, population category, assessment payload and details, checklist draft, section, item and area type).
- TanStack Query defaults (`src/components/providers.tsx`): `staleTime` 60 s, `retry` 1.

## Rules and gotchas

- Change the schema with a new idempotent file in `prisma/manual/` plus the matching `schema.prisma` edit. Never `prisma db push`, `migrate dev` or `migrate reset`.
- Apply a manual file over the direct connection (`DIRECT_URL`, port 5432); `db execute` hangs on the pooler (6543). Production runs it in the Supabase SQL editor before the deploy.
- Some constraints exist only in SQL: `CHECK`s on `bystander_reports.contact_number` and `photo_paths` (max 3), population count `>= 0`, assessment item pillar rules, `floor_count >= 1`, `ended_at >= started_at`, and the one-published-version unique index. Prisma does not know them.
- The generated client goes to the default `@prisma/client` (no `output` in the generator) and code imports from `@prisma/client`; `postinstall` runs `prisma generate`.
- `prisma/seed.ts` connects with `SHADOW_DATABASE_URL`, not `DATABASE_URL`. It writes every cluster and event to the fixed campus id `f5b2b08d-d24a-4fbc-af3a-defe18b8f03d`. Lookups use `createMany` with `skipDuplicates`, but events are `create`d, so re-running adds duplicate NSED events.
- `supabase-admin.ts` holds the service-role key. Import it only from server code.
- `Report` still has the fixed headcount columns (`faculty_members` … `guests`, listed in `HEADCOUNT_FIELDS`) beside the per-campus `ReportPopulationCount` rows.

## Decisions

- [[0001-server-actions-only]] Prisma is used only inside `'use server'` actions.
- [[0002-manual-sql-schema-changes]] schema changes ship as `prisma/manual/*.sql`.
- [[0006-versioned-checklist-template]] the assessment tables model versioned templates.
- [[0009-table-driven-settings]] the lookup models share one generic settings UI.
