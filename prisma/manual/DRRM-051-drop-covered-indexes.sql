-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-051 · Drop the single-column indexes a wider index already covers
-- Plan: docs/plan/fix/DRRM-051-post-hardening-follow-ups.md · follow-up of DRRM-048 §4
--
-- Postgres can use an index for any leading part of its columns, so an index on (a) adds
-- nothing next to an index on (a, b): it only costs space and a write on every insert and
-- update. These four are covered:
--
--   reports (event_id)                   by idx_reports_event_submitted (event_id, submitted_at)
--                                        and idx_reports_event_user (event_id, user_id)
--   reports (cluster_id)                 by idx_reports_cluster_submitted (cluster_id, submitted_at)
--   bystander_reports (status_id)        by idx_bystander_reports_status_submitted
--                                        (status_id, submitted_at)
--   report_population_counts (report_id) by the unique (report_id, category_id)
--
-- Each one is found by what it indexes, not by name, because the unnamed ones were named by
-- whatever created the table. It is dropped only while another valid index on the table
-- still starts with the same column, so running this before DRRM-048's file drops nothing.
--
-- HOW TO APPLY: run this whole file in the Supabase SQL editor (or `db execute` over the
-- direct connection, see docs/modules/database.md) on staging and production. The code does
-- not depend on it, so it can run before or after the deploy. It is idempotent: safe to re-run.
-- Each DROP takes a short exclusive lock on its table; these tables are small.
--
-- BEFORE / AFTER (read-only): the indexes on the three tables.
--
--   SELECT tablename, indexname, indexdef FROM pg_indexes
--   WHERE schemaname = 'public'
--     AND tablename IN ('reports', 'bystander_reports', 'report_population_counts')
--   ORDER BY tablename, indexname;
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  target record;
  single record;
  dropped text;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('reports', 'event_id'),
      ('reports', 'cluster_id'),
      ('bystander_reports', 'status_id'),
      ('report_population_counts', 'report_id')
    ) AS t(table_name, column_name)
  LOOP
    -- The plain, non-unique btree index on exactly this one column.
    FOR single IN
      SELECT i.indexrelid::regclass AS index_name
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
      JOIN pg_class ic ON ic.oid = i.indexrelid
      JOIN pg_am am ON am.oid = ic.relam
      WHERE n.nspname = 'public'
        AND c.relname = target.table_name
        AND a.attname = target.column_name
        AND i.indnkeyatts = 1
        AND i.indnatts = 1
        AND NOT i.indisunique
        AND NOT i.indisprimary
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND am.amname = 'btree'
    LOOP
      IF EXISTS (
        SELECT 1
        FROM pg_index w
        JOIN pg_attribute wa ON wa.attrelid = w.indrelid AND wa.attnum = w.indkey[0]
        JOIN pg_class wc ON wc.oid = w.indrelid
        JOIN pg_namespace wn ON wn.oid = wc.relnamespace
        JOIN pg_class wic ON wic.oid = w.indexrelid
        JOIN pg_am wam ON wam.oid = wic.relam
        WHERE wn.nspname = 'public'
          AND wc.relname = target.table_name
          AND wa.attname = target.column_name
          AND w.indexrelid <> single.index_name::oid
          AND w.indnkeyatts > 1
          AND w.indisvalid
          AND w.indpred IS NULL
          AND wam.amname = 'btree'
      ) THEN
        dropped := single.index_name::text; -- read before the drop, or it prints the oid
        EXECUTE format('DROP INDEX IF EXISTS %s', dropped);
        RAISE NOTICE 'Dropped %, covered by a wider index on %.%',
          dropped, target.table_name, target.column_name;
      ELSE
        RAISE NOTICE 'Kept %: no wider index on %.% yet (run DRRM-048 first)',
          single.index_name, target.table_name, target.column_name;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;

-- ROLLBACK (puts the four back, under the names Prisma would give them):
--
--   CREATE INDEX IF NOT EXISTS reports_event_id_idx ON public.reports (event_id);
--   CREATE INDEX IF NOT EXISTS reports_cluster_id_idx ON public.reports (cluster_id);
--   CREATE INDEX IF NOT EXISTS bystander_reports_status_id_idx ON public.bystander_reports (status_id);
--   CREATE INDEX IF NOT EXISTS idx_report_pop_counts_report ON public.report_population_counts (report_id);
