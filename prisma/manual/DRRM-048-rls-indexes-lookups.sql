-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-048 · Row level security everywhere, missing indexes, case-insensitive lookup names
-- Plan: docs/plan/fix/DRRM-048-db-concurrency-performance.md · GitHub #108, #109
--
--   1. Turns on row level security for every table in `public` that doesn't have it yet. The
--      app reaches its tables only through Prisma as the `postgres` role, which owns them and
--      bypasses RLS; with RLS on and no policies, the publishable (anon) key in the browser
--      can no longer read or write them through the Supabase REST API (#109).
--   2. Adds the foreign-key and filter/sort indexes the lists, the dashboard and the
--      one-report-per-member check use (#109, DRRM-046).
--   3. Makes unit names (per cluster) and position names unique regardless of case, so two
--      people typing "CaseUnit" and "caseunit" at once can't add both (#108). Skipped, with a
--      NOTICE naming them, while case-variant duplicates already exist: merge those in Settings
--      and run the file again.
--
-- HOW TO APPLY: run this whole file in the Supabase SQL editor (or psql as the `postgres`
-- role) on every database the code runs against (staging and production). The code does not
-- depend on it to work, so it can run before or after the deploy; run it soon either way,
-- because step 1 is what closes the REST API. It is idempotent: safe to re-run.
--
-- BEFORE: see which tables are open now (read-only):
--
--   SELECT c.relname, c.relrowsecurity,
--          (SELECT count(*) FROM pg_policies p
--            WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
--   ORDER BY c.relrowsecurity, c.relname;
--
-- AFTER: the same query shows relrowsecurity = true on every row, and a request with only the
-- publishable key to /rest/v1/reports?select=* (or users, bystander_reports) returns no rows.
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Row level security ───────────────────────────────────────────────────────

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    RAISE NOTICE 'RLS enabled on public.%', t.relname;
  END LOOP;
END $$;

-- A policy written for anon or authenticated would reopen a table; list any for review.
DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname, roles::text AS roles, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    RAISE NOTICE 'Review policy % on public.% (roles %, %)', p.policyname, p.tablename, p.roles, p.cmd;
  END LOOP;
END $$;

-- 2. Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_campus_created ON public.users (campus_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_unit_id ON public.users (unit_id);
CREATE INDEX IF NOT EXISTS idx_users_user_type_id ON public.users (user_type_id);

CREATE INDEX IF NOT EXISTS idx_clusters_campus_active ON public.clusters (campus_id, is_active);
CREATE INDEX IF NOT EXISTS idx_units_cluster_active ON public.units (cluster_id, is_active);

CREATE INDEX IF NOT EXISTS idx_events_campus_status_started
  ON public.events (campus_id, status_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_status_started
  ON public.events (status_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_event_submitted
  ON public.reports (event_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_cluster_submitted
  ON public.reports (cluster_id, submitted_at DESC);
-- The one-report-per-member-per-event check in createReport (DRRM-046).
CREATE INDEX IF NOT EXISTS idx_reports_event_user ON public.reports (event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_reports_unit_id ON public.reports (unit_id);

CREATE INDEX IF NOT EXISTS idx_bystander_reports_cluster_submitted
  ON public.bystander_reports (cluster_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_bystander_reports_status_submitted
  ON public.bystander_reports (status_id, submitted_at DESC);

-- 3. Case-insensitive unique names ────────────────────────────────────────────

DO $$
DECLARE
  d record;
  found boolean := false;
BEGIN
  FOR d IN
    SELECT cluster_id, lower(name) AS name, count(*) AS n
    FROM public.units
    GROUP BY cluster_id, lower(name)
    HAVING count(*) > 1
  LOOP
    found := true;
    RAISE NOTICE 'Units in cluster % share the name "%" (% rows): merge them in Settings',
      d.cluster_id, d.name, d.n;
  END LOOP;
  IF found THEN
    RAISE NOTICE 'Skipped uq_units_cluster_lower_name until those are merged.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_units_cluster_lower_name
      ON public.units (cluster_id, lower(name));
  END IF;
END $$;

DO $$
DECLARE
  d record;
  found boolean := false;
BEGIN
  FOR d IN
    SELECT lower(name) AS name, count(*) AS n
    FROM public.positions
    GROUP BY lower(name)
    HAVING count(*) > 1
  LOOP
    found := true;
    RAISE NOTICE 'Positions share the name "%" (% rows): merge them in Settings', d.name, d.n;
  END LOOP;
  IF found THEN
    RAISE NOTICE 'Skipped uq_positions_lower_name until those are merged.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_positions_lower_name ON public.positions (lower(name));
  END IF;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (indexes and the name rule only; leave RLS on, it only closes the REST API):
--
--   BEGIN;
--   DROP INDEX IF EXISTS public.uq_units_cluster_lower_name;
--   DROP INDEX IF EXISTS public.uq_positions_lower_name;
--   DROP INDEX IF EXISTS public.idx_users_campus_created;
--   DROP INDEX IF EXISTS public.idx_users_unit_id;
--   DROP INDEX IF EXISTS public.idx_users_user_type_id;
--   DROP INDEX IF EXISTS public.idx_clusters_campus_active;
--   DROP INDEX IF EXISTS public.idx_units_cluster_active;
--   DROP INDEX IF EXISTS public.idx_events_campus_status_started;
--   DROP INDEX IF EXISTS public.idx_events_status_started;
--   DROP INDEX IF EXISTS public.idx_reports_event_submitted;
--   DROP INDEX IF EXISTS public.idx_reports_cluster_submitted;
--   DROP INDEX IF EXISTS public.idx_reports_event_user;
--   DROP INDEX IF EXISTS public.idx_reports_unit_id;
--   DROP INDEX IF EXISTS public.idx_bystander_reports_cluster_submitted;
--   DROP INDEX IF EXISTS public.idx_bystander_reports_status_submitted;
--   COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
