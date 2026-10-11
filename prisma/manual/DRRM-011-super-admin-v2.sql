-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-011 · Super admin v2
-- Plan: docs/plan/feature/DRRM-011-super-admin-v2.md
--
-- Adds what the redesigned event details page shows after Complete event:
--   1. events.completed_by — the user who completed the event ("Completed on … by …").
--      Null for events completed before this change, and whenever the status is not
--      Completed. Deleting that user keeps the event and clears the column.
--
-- HOW TO APPLY: run this whole file once in the Supabase SQL editor (or psql as the
-- `postgres` role) BEFORE deploying the code on feat/DRRM-011-super-admin-v2.
-- Prisma selects the new column, so the old deploy keeps working after this runs but
-- the new deploy does not work before it. The script is idempotent — safe to re-run.
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS completed_by UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_completed_by_fkey'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_completed_by_fkey
      FOREIGN KEY (completed_by) REFERENCES public.users (id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

COMMIT;

-- No RLS change: events is only read and written through Prisma (server actions), and the
-- new column holds a user id, not personal data.

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (only if reverting the code too):
--
--   BEGIN;
--   ALTER TABLE public.events
--     DROP CONSTRAINT IF EXISTS events_completed_by_fkey,
--     DROP COLUMN IF EXISTS completed_by;
--   COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
