-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-042 · Unopened bystander reports
-- Plan: docs/plan/feature/DRRM-042-bystander-assessments-polish.md
--
-- The Bystander reports list marks a report unopened (a red dot and a red age) until an admin
-- opens it:
--   1. bystander_reports.seen_at — when an admin first opened it (null: not yet)
--   2. Backfill: reports already reviewed, verified or dismissed count as opened.
--
-- HOW TO APPLY: run this whole file once in the Supabase SQL editor (or psql as the
-- `postgres` role) on every database the code runs against (staging and production). The code
-- works before it runs (no report shows as unopened), so the order doesn't matter. The script
-- is idempotent — safe to re-run.
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.bystander_reports
  ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ;

-- Someone acted on these, so they were opened. Pending ones stay unopened.
UPDATE public.bystander_reports r
SET seen_at = r.submitted_at
FROM public.bystander_report_statuses s
WHERE r.status_id = s.id
  AND s.name <> 'pending'
  AND r.seen_at IS NULL;

COMMIT;
