# MATATAG assessment database schema is not installed

- **Status:** In Progress
- **Severity:** High
- **Affected Area:** Dashboard / MATATAG Assessments
- **Discovered Date:** 2026-09-17
- **Related PR / Commit:**

---

## 1. Description & Reproduction

### Summary

`/assessments` renders the assessment-service alert because the configured database does not yet contain the MATATAG tables required by the new server actions.

### Steps to Reproduce

1. Sign in as an Administrator or Super Admin.
2. Open `/assessments`.
3. The page shows `The assessment service is unavailable...`.

### Expected Behavior

The page lists campus forms (or an empty list) and Super Admins can create a form.

### Actual Behavior

Prisma raises a missing-table or missing-column error (`P2021`/`P2022`). The action previously converted it to a generic service error.

---

## 2. Root Cause Analysis (RCA)

- **Files involved:** `src/actions/matatag/index.ts`, `prisma/schema.prisma`, `prisma/migrations/20260915000000_add_matatag_assessments/`, `prisma/migrations/20260917000000_add_matatag_templates/`, `prisma/migrations/20260918000000_add_campus_matatag_forms/`, `prisma/migrations/20260921000000_add_matatag_phases_and_assignments/`
- **Root cause:** The application code and Prisma client expect `matatag_assessments`, `matatag_templates`, and `matatag_forms`, but the live schema check found those tables absent. The action catch block hid the Prisma code behind a generic alert.
- **Security posture:** Browser/PostgREST access is intentionally revoked. All reads and writes go through authenticated server actions, so the tables must exist before the dashboard can work.

The action now logs the Prisma code and returns a specific schema-installation message for `P2021`/`P2022`.

---

## 3. Database rollout

Apply these additive SQL files through the approved database deployment process, in this order:

1. `prisma/migrations/20260915000000_add_matatag_assessments/migration.sql`
2. `prisma/migrations/20260917000000_add_matatag_templates/migration.sql`
3. `prisma/migrations/20260918000000_add_campus_matatag_forms/migration.sql`
4. `prisma/migrations/20260921000000_add_matatag_phases_and_assignments/migration.sql`

The current default checklist is embedded in the application, so no seed `INSERT` is required. When a Super Admin publishes the default editor, the first immutable row is inserted into `matatag_templates`. When a Super Admin creates a campus assessment, the app transaction inserts one `matatag_forms` row and revision 1 in `matatag_templates`.

Do not run `prisma db push`, `prisma migrate dev`, or `prisma migrate reset`. This workspace also has no reconciled `_prisma_migrations` history, so do not blindly run `prisma migrate deploy` against an existing database; apply/reconcile the additive SQL using the project’s controlled deployment process first.

## 4. Local-only migration test

Run this against a disposable local Postgres database, never the `.env` production URL:

```powershell
docker run --name matatag-postgres-test `
  -e POSTGRES_PASSWORD=local-only `
  -e POSTGRES_DB=matatag_local `
  -p 54329:5432 -d postgres:17

# Run this in a separate shell so DATABASE_URL cannot point at production.
$env:DATABASE_URL = 'postgresql://postgres:<local-password>@localhost:<local-port>/matatag_local'
```

The three MATATAG migrations reference the existing `users` and `campus` tables. For a schema-only test, create minimal disposable parent tables, then apply the three migration SQL files through the container’s `psql`:

```powershell
@'
create table campus (id uuid primary key, name text not null, is_active boolean not null default true);
create table users (id uuid primary key);
'@ | docker exec -i matatag-postgres-test psql -U postgres -d matatag_local

Get-Content prisma/migrations/20260915000000_add_matatag_assessments/migration.sql |
  docker exec -i matatag-postgres-test psql -U postgres -d matatag_local
Get-Content prisma/migrations/20260917000000_add_matatag_templates/migration.sql |
  docker exec -i matatag-postgres-test psql -U postgres -d matatag_local
Get-Content prisma/migrations/20260918000000_add_campus_matatag_forms/migration.sql |
  docker exec -i matatag-postgres-test psql -U postgres -d matatag_local
Get-Content prisma/migrations/20260921000000_add_matatag_phases_and_assignments/migration.sql |
  docker exec -i matatag-postgres-test psql -U postgres -d matatag_local
```

Verify the catalog queries below and run the count queries. Drop the container when finished:

```powershell
docker rm -f matatag-postgres-test
```

This validates DDL, foreign keys, indexes, uniqueness, and RLS. It does not validate Supabase Auth or the full dashboard until the local database also has the project’s baseline schema and seed users.

### Local restore completed

The supplied custom-format dump was restored into `itala-postgres-local` at `localhost:54329/local_db_itala` with `--schema=public --no-owner --no-acl`. The local copy contains 62 user profiles, 11 campuses, and the reference tables. The following operational rows were removed from the local copy only: reports, report casualties, missing persons, population counts, bystander reports, and events. User/campus/role data was retained so existing `auth_id` mappings can be used while Prisma points to the local database. The original dump file was not modified.

The local MATATAG migrations then completed successfully. The local MATATAG tables are empty and ready for form/template/response testing. Supabase `auth`, `storage`, and other internal schemas were intentionally not restored; the application-data test uses the existing Supabase Auth configuration separately from local Prisma data.

The workspace now has an ignored `.env.local` containing the local `DATABASE_URL`, so `npm run dev` uses port `54329` by default. Keep the supplied backup and local user profiles private; they are production-derived data even though the database is local.

### Read-only preflight

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('matatag_assessments', 'matatag_templates', 'matatag_forms')
order by table_name;

select indexname, tablename
from pg_indexes
where schemaname = 'public'
  and tablename in ('matatag_assessments', 'matatag_templates', 'matatag_forms')
order by tablename, indexname;
```

Expected after rollout: all three tables exist, with RLS enabled and no `anon`/`authenticated` table grants.

### Post-rollout smoke checks

```sql
select count(*) from public.matatag_forms;
select count(*) from public.matatag_templates;
select count(*) from public.matatag_assessments;
```

Then restart the app and verify, using authorized accounts:

1. Super Admin creates a campus form.
2. Campus Administrator edits and opens it.
3. A user assigned to that campus submits one response.
4. The submitted response is locked; an authorized admin can reopen it.

---

## 5. Query and index notes

The current Prisma queries are intentionally simple and use the indexes needed for the access paths:

| Query path                        | Index                                                          | Reason                                                        |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| Forms by campus, newest first     | `(campus_id, updated_at)`                                      | Campus Administrator list and campus authorization            |
| Responses by form, newest first   | `(form_id, updated_at)`                                        | Assessment response list and count                            |
| Responses by campus, newest first | `(campus_id, updated_at)`                                      | Campus-scoped fallback/legacy records                         |
| Responses by user, newest first   | `(user_id, updated_at)`                                        | Ownership and user history                                    |
| Template revision lookup          | `(form_id, revision)` plus partial default-revision uniqueness | Immutable revisions and concurrent-publish conflict detection |

The list uses `take: 20` and `skip` pagination. Search uses a case-insensitive `contains` filter, which becomes `ILIKE '%term%'`; a normal B-tree index cannot accelerate a leading-wildcard search. Do not add a trigram index speculatively. If `EXPLAIN (ANALYZE, BUFFERS)` shows search latency at production volumes, add `pg_trgm` and a GIN index on `matatag_forms.title` (and only the response columns that need it).

The campus composite index does not optimize the Super Admin’s unfiltered `order by updated_at`; leave it as-is while the form count is small, then add a standalone `updated_at` B-tree index only if an execution plan shows the global list sort is material.

Example diagnostic query:

```sql
explain (analyze, buffers)
select id, title, campus_id, is_open, updated_at
from public.matatag_forms
where campus_id = '00000000-0000-0000-0000-000000000000'
order by updated_at desc
limit 20 offset 0;
```

Keep writes transactional: form creation copies the current default definition and creates the form template in one transaction; template publication creates a new immutable revision instead of updating old JSON. This preserves historical responses and avoids partial forms.

---

## 6. Verification

- `npm run type-check`: passed.
- `npx tsx --test scripts/test-matatag.ts scripts/test-matatag-template-actions.ts "src/app/(public)/matatag/question-content.test.ts" "src/app/(public)/matatag/section-swipe.test.ts"`: 11 tests passed.
- `npm run build`: passed.
- Live database writes were not performed from this workspace; migration rollout remains the required operational step.
