# MATATAG release and production migration guide

- **Status:** In Review
- **Branch:** `feat/MATATAG`
- **Purpose:** Review gates and step-by-step release procedure for the digital MATATAG assessment feature.

This guide covers local checks, testing in the shared development environment, the production migration, deployment, and post-release checks. It does not authorize a database change. An operator must use the team's approved database release process and the confirmed target environment.

## 1. Release scope

The branch adds a digital MATATAG assessment workflow, including the checklist editor, published checklist revisions, campus forms, PRE/POST phases, assigned-user access, submissions, response review, dashboards, and server-side access checks. Review the implementation and route behavior in the branch before release.

The database changes are additive and must be applied in this order:

1. `prisma/migrations/20260915000000_add_matatag_assessments/migration.sql`
2. `prisma/migrations/20260917000000_add_matatag_templates/migration.sql`
3. `prisma/migrations/20260918000000_add_campus_matatag_forms/migration.sql`
4. `prisma/migrations/20260921000000_add_matatag_phases_and_assignments/migration.sql`

The migrations depend on existing `public.users` and `public.campus` tables. The first three migrations enable RLS and revoke table grants from Supabase's `anon` and `authenticated` roles. The fourth currently omits both protections on `matatag_form_assignments`; this is a production blocker. Application access is intended to go through authorized server actions and Prisma.

## 2. Branch review and release gate

The branch review report at [`docs/plan/review/2026-09-16-matatag-branch-review.md`](../review/2026-09-16-matatag-branch-review.md) records earlier findings. The current reviewed worktree is newer than that report, so do not treat the old report as evidence that a finding remains open or is fixed. Current review findings:

**Reviewed snapshot:** `feat/MATATAG` at `5d83deb` (same commit as `dev`) plus the current tracked and untracked worktree changes. The MATATAG implementation is not committed in this snapshot, so re-review the final commit before release.

| Priority | Location                                                                                               | Finding / required gate                                                                                                                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | `prisma/migrations/20260921000000_add_matatag_phases_and_assignments/migration.sql`                    | `matatag_form_assignments` lacks RLS and `REVOKE ALL` for `anon`/`authenticated`. Add and review both protections before migration; verify the dev and production catalogs show RLS enabled and no direct grants.                     |
| P1       | `src/actions/matatag/index.ts` (`saveMatatagAssessment`)                                               | Campus Administrators can overwrite another user's general response, including a completed response. Add an ownership/status rule or an explicit authorized admin workflow, then test that unauthorized updates are rejected.         |
| P1       | `src/app/(public)/matatag/assessments/page.tsx` and `src/components/matatag/matatag-form.tsx`          | “New assessment” navigates to `/matatag`, which restores the existing `default:new` local draft and its record identity. Add an explicit new-assessment flow and verify the previous record is not overwritten.                       |
| P2       | `src/actions/matatag/index.ts` (`getMatatagForm`)                                                      | A respondent who can load a form receives every assigned member's ID and name/username. Return assignment identities only to managers; verify respondent payloads omit them.                                                          |
| P2       | `src/actions/matatag/index.ts`, `src/lib/matatag-access.ts`, `src/components/matatag/matatag-form.tsx` | Super Admin campus behavior is inconsistent: the campus list includes all campuses, while save authorization and the UI restrict a Super Admin with an assigned campus. Confirm intended scope and make the server and UI consistent. |
| P2       | `package.json`, `.github/workflows/ci.yml`                                                             | MATATAG tests are not in the package scripts or CI. Add an automated CI invocation so the authorization and scoring checks run on future changes.                                                                                     |
| P3       | `src/components/layout/app-sidebar.tsx`                                                                | Production build warns that the named `version` import from `package.json` will stop working. Use the default JSON import; this is not a migration blocker.                                                                           |

Earlier findings about group-negative scoring, rejected-draft loss, individual record cache invalidation, import/recovery handling, inactive-unit filtering, section comments, print metadata, and authenticated browser setup were reported as resolved or passed in the current review. Keep their regression checks in the release run.

**Review checks:** the focused MATATAG test runs passed (14 tests plus one mocked action check); `npm run type-check`, focused MATATAG ESLint, full lint, `npm run build`, `npx prisma validate`, and `git diff --check` passed. Full lint emitted 15,075 CRLF/Prettier warnings, and the build emitted the sidebar JSON import warning above. `npx prisma migrate status` could not connect to `localhost:54329` (P1001), so this review did not validate against a running PostgreSQL database or execute migrations.

Before testing the migration in dev, resolve all P1 findings above and confirm that the current review has no unresolved release-blocking correctness, data-loss, or authorization finding. Specifically verify scoring of grouped negative questions, recovery of invalid local drafts, versioned saves/reopens, new-assessment identity, template snapshot behavior, and role/campus/assigned-user boundaries.

Record the review disposition and any remaining release gates here or in the current branch review report. Stop the rollout for any unresolved data-loss or access-control issue.

## 3. Local checks

### 3.1 Check tools and isolate the database

Use a local disposable PostgreSQL 17 database for SQL validation. Do not use a production or shared dev connection for this stage. Docker Desktop must be running.

In PowerShell, first confirm the container name is unused:

```powershell
docker ps -a --filter "name=^/matatag-migration-test$"
```

If that returns no container, start the disposable database:

```powershell
docker run --name matatag-migration-test `
  -e POSTGRES_PASSWORD=local-only `
  -e POSTGRES_DB=matatag_test `
  -p 54330:5432 -d postgres:17
```

create a file `.env.local`

```txt
# Local-only database. Keep production DATABASE_URL in .env untouched.
DATABASE_URL=<local-full-schema-database-connection-string>
```

Wait until PostgreSQL accepts connections:

```powershell
docker exec matatag-migration-test pg_isready -U postgres -d matatag_test
```

### 3.2 Create only the migration prerequisites

The migration smoke test needs the parent tables and the two Supabase roles. These are minimal stand-ins in the disposable database, not a copy of the application schema:

```powershell
@'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.campus (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE public.users (id UUID PRIMARY KEY);
'@ | docker exec -i matatag-migration-test psql -U postgres -d matatag_test -v ON_ERROR_STOP=1
```

### 3.3 Apply and inspect the SQL

Apply each migration once, in order. `--single-transaction` rolls back a file if one of its statements fails. Stop on any error; do not continue to the next file or blindly rerun a partially applied file.

```powershell
Get-Content -Raw prisma/migrations/20260915000000_add_matatag_assessments/migration.sql |
  docker exec -i matatag-migration-test psql -U postgres -d matatag_test -v ON_ERROR_STOP=1 --single-transaction

Get-Content -Raw prisma/migrations/20260917000000_add_matatag_templates/migration.sql |
  docker exec -i matatag-migration-test psql -U postgres -d matatag_test -v ON_ERROR_STOP=1 --single-transaction

Get-Content -Raw prisma/migrations/20260918000000_add_campus_matatag_forms/migration.sql |
  docker exec -i matatag-migration-test psql -U postgres -d matatag_test -v ON_ERROR_STOP=1 --single-transaction

Get-Content -Raw prisma/migrations/20260921000000_add_matatag_phases_and_assignments/migration.sql |
  docker exec -i matatag-migration-test psql -U postgres -d matatag_test -v ON_ERROR_STOP=1 --single-transaction
```

Confirm all four tables, RLS, indexes, and direct table privileges:

```powershell
@'
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('matatag_assessments', 'matatag_templates', 'matatag_forms', 'matatag_form_assignments')
ORDER BY c.relname;

SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'matatag_%'
ORDER BY tablename, indexname;

SELECT table_name, role_name, privilege
FROM unnest(ARRAY['matatag_assessments', 'matatag_templates', 'matatag_forms', 'matatag_form_assignments']) AS t(table_name)
CROSS JOIN unnest(ARRAY['anon', 'authenticated']) AS r(role_name)
CROSS JOIN unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) AS p(privilege)
WHERE has_table_privilege(role_name, 'public.' || table_name, privilege)
ORDER BY table_name, role_name, privilege;
'@ | docker exec -i matatag-migration-test psql -U postgres -d matatag_test -v ON_ERROR_STOP=1
```

Expected after the required migration fix: four rows with `rls_enabled = true`; expected indexes appear; and the privilege query returns no rows. In the current branch, the form-assignments row is expected to show RLS disabled; the grant query may also show privileges inherited from role defaults. Do not proceed until the migration is corrected and both checks pass. This verifies the DDL and privilege statements only. It does not verify Supabase Auth, existing production constraints/data, application permissions, or deployment migration history.

When finished with this disposable container, remove it:

```powershell
docker rm -f matatag-migration-test
```

### 3.4 Run application checks locally

Use a local database with the complete application schema and disposable test accounts for authenticated flows. Set `DATABASE_URL` to that local database and auth settings to a development Supabase project. Never point a local app at production. Keep credentials in ignored local environment files; do not put secrets or database dumps in Git.

For PowerShell sessions, set the required values from the local/dev secret store before installing or starting the app. Use the local full-schema database here, not the minimal migration-smoke container from Section 3.1:

```powershell
$env:DATABASE_URL = '<local full-schema Postgres connection string>'
$env:SHADOW_DATABASE_URL = '<local-only shadow database connection string>'
$env:NEXT_PUBLIC_SUPABASE_URL = '<development Supabase project URL>'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = '<development publishable key>'
$env:SUPABASE_SERVICE_ROLE_KEY = '<development-only service role key>'
```

Use a separate local shadow database. The application does not need it at runtime, but Prisma configuration expects it for Prisma commands. Keep the service role key server-side and out of browser-visible variables, source control, and logs.

From the repository root:

```powershell
npm ci
npx prisma generate
npx tsx --test scripts/test-matatag.ts scripts/test-matatag-template-actions.ts src/lib/matatag-question-content.test.ts src/components/matatag/section-swipe.test.ts
npm run lint
npm run type-check
npm run build
npm run dev
```

In the local app, test with disposable authorized accounts:

1. Sign in and open the MATATAG editor. Create a draft, enter answers and remarks, reload, and confirm recovery.
2. Export a draft, import it into a fresh draft, and confirm form content is restored without importing another record's identity or version.
3. Test section navigation, grouped questions, starred negative questions, N/A toggling, score totals, completion validation, and print output.
4. Create and publish a template revision. Confirm a pre-existing assessment continues to use its saved revision.
5. Create a PRE form and a POST form. Test campus-wide and assigned-only access.
6. Save and reopen a response; test simultaneous/stale version behavior and confirm a rejected save preserves the user's draft.
7. Confirm unauthorized roles and users from another campus cannot read, edit, publish, or submit outside their scope.

The repository's `npm run test` script is not configured. Use the explicit `tsx --test` command above. The browser script `scripts/check-matatag-browser.cjs` requires an authenticated test setup for editor flows; only rely on it after confirming the current script is configured with such a setup.

## 4. Development environment test

Use the dedicated dev Supabase/Postgres project and dev Auth configuration. Confirm the target by its project reference/host before connecting. Do not substitute production credentials. The MATATAG SQL is not safe to replay: the files are additive DDL, not idempotent scripts.

### 4.1 Preflight dev database

Before applying SQL, have the dev database owner confirm a recoverable backup or snapshot, then run read-only checks in the dev SQL console:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('users', 'campus', 'matatag_assessments', 'matatag_templates', 'matatag_forms', 'matatag_form_assignments')
order by table_name;

select to_regclass('public._prisma_migrations') as prisma_migrations_table;
```

Confirm the parent tables exist. If any MATATAG table already exists, stop and compare its columns, constraints, indexes, RLS, grants, and data with the migrations before taking action. Do not drop or recreate it to make the script pass.

The previous feature notes report that `_prisma_migrations` was absent in the checked database. Recheck the current dev target. Because Prisma's migration history may not be reconciled with this repository, use the approved SQL deployment workflow for the four reviewed files; do not run `prisma migrate deploy`, `migrate dev`, `db push`, or `migrate reset` as a shortcut.

### 4.2 Apply to dev and deploy the app

1. Have the database owner review the exact four committed SQL files and confirm the dev target.
2. Apply them one at a time, in the order in Section 1, through the team's controlled SQL migration process. Keep an execution record for each file. Stop on the first error; preserve the error and resulting schema state for review.
3. Re-run the catalog/RLS/grant checks from Section 3.3 against dev. Confirm all four tables exist, RLS is enabled, and `anon`/`authenticated` have no direct table privileges.
4. Deploy the reviewed MATATAG application revision to the dev application environment only after the schema is ready. Regenerate Prisma Client during the normal build/deploy process and restart the application.
5. Configure dev app variables to use the dev Supabase Auth project and dev Postgres endpoint. Keep service-role and database credentials server-only.

### 4.3 Run dev acceptance checks

Use named test accounts for Super Admin, Campus Administrator, assigned evaluator, unassigned evaluator, and a user from a different campus. Do not use real respondent data.

1. Super Admin publishes a default template revision and creates a campus form.
2. Campus Administrator can manage only their campus form, edit it, and open/close responses.
3. Assigned-only forms reject unassigned users; campus forms reject users outside the campus; closed forms reject submissions.
4. Authorized evaluators create and submit PRE and POST responses. Confirm submitted responses lock as intended.
5. Verify admins can review and reopen responses only within their allowed scope.
6. Verify counts and dashboard metrics for default and form-specific responses without cross-campus leakage.
7. Open logs for missing table/column errors, authorization failures, and stale version conflicts. Confirm a stale save returns a recoverable conflict and does not discard client work.
8. Repeat the local scoring, draft recovery/import, template snapshot, and print checks in the deployed dev app.

Do not proceed until the migration completed cleanly, the dev app is healthy, and all role/scope and assessment acceptance checks pass.

## 5. Before production migration

Complete and record every item before opening the production change:

- [ ] Current branch review is complete; release-blocking findings are fixed and reviewed.
- [ ] The feature changes and all four SQL files are committed and included in the approved release revision.
- [ ] CI and the local checks in Section 3.4 pass on that revision.
- [ ] Section 4 dev migration and acceptance checks pass; evidence and test account roles are recorded without secrets or personal data.
- [ ] Confirm the production Supabase project reference/host and database name using the approved secret manager; a second operator verifies the target.
- [ ] Confirm a recent restorable backup/PITR point and identify the database operator responsible for recovery.
- [ ] Capture the current production catalog state for the parent tables, MATATAG table names, `_prisma_migrations`, indexes, constraints, RLS, and grants using read-only queries.
- [ ] Reconcile Prisma migration history with the actual production schema with the database owner. If `_prisma_migrations` is absent or the historical baseline is not recorded, agree on the migration-history strategy before applying SQL. Do not mark migrations applied or baseline the database by guesswork.
- [ ] Confirm whether any MATATAG objects or data already exist. If they do, compare them to the exact migration definitions and agree on a data-preserving plan.
- [ ] Review the four SQL files line by line. Do not bundle unrelated migrations or make unreviewed edits during the release.
- [ ] Choose a low-traffic release window, identify the operator and verifier, and prepare the application rollback revision. These migrations add schema objects; rollback should normally be an application rollback, not dropping tables.
- [ ] Confirm the production app release can be deployed after schema setup and that the new Prisma Client will be generated and the app restarted.

If any preflight differs from the reviewed dev state, stop and reassess the plan with the database owner. Do not use `prisma db push`, `prisma migrate dev`, `prisma migrate reset`, or an unreconciled `prisma migrate deploy` against production.

## 6. Production migration and deployment

The database operator applies the exact four reviewed files to the confirmed production database through the approved controlled SQL migration process. Run them sequentially, in separate recorded steps, in the order in Section 1. Do not edit the files at execution time. Stop immediately if any statement fails; do not continue or blindly rerun that migration. Preserve the SQL error and inspect the transaction/schema state with the database owner before deciding how to resume.

After each file, record the migration name, target project, start/end time, result, and operator in the release record. Avoid placing connection strings, access tokens, or respondent data in the record.

After all four finish:

1. Run read-only catalog checks and verify all four tables, expected indexes, foreign keys, constraints, enabled RLS, and revoked direct grants.
2. Deploy the exact application revision approved in Section 5. Generate Prisma Client and restart through the normal production deployment pipeline.
3. Check app health, server logs, and `/assessments` and `/matatag` with authorized production test accounts.
4. Verify one controlled form/template/response lifecycle with the service owner. Confirm a user cannot access another campus or an unassigned form.
5. Check that saves, list/reopen, submission lock, dashboards, and print work. Confirm no P2021/P2022 missing-schema errors or authorization failures.
6. Monitor error rates and support reports for the agreed release window. Record the outcome and mark this guide **Done** only after the owner accepts production verification.

## 7. Recovery and stop conditions

Stop the migration on any unexpected existing table, schema drift, failed statement, missing parent table/role, unresolved migration-history mismatch, or production target uncertainty. Do not drop MATATAG tables as an automatic rollback.

If deployment reveals an application defect after the additive SQL succeeds, roll the application back to the approved previous revision while leaving the additive tables in place. Preserve logs and migration records, then fix and re-test in dev. Any schema rollback or data correction requires a separate reviewed plan and the database owner's approval.

## 8. Release completion criteria

- All four migrations are recorded as applied to the intended environments, with production history reconciled by the database owner.
- The deployed app uses the matching generated Prisma Client and passes production smoke and authorization checks.
- Dev and production verification evidence is recorded without credentials or personal data.
- No unresolved release-blocking review findings remain.
- This document's status is updated to **Done** by the release owner.
