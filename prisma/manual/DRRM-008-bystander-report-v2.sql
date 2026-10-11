-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-008 · Bystander report v2
-- Plan: docs/plan/feature/DRRM-008-bystander-report-v2.md
--
-- Adds what the redesigned bystander form collects:
--   1. bystander_reports.contact_number — optional follow-up number (+63…), admin-only
--   2. bystander_reports.photo_paths    — up to 3 object paths in the private photo bucket
--   3. bystander_report_population_counts — headcount, same shape as report_population_counts
--   4. Storage bucket `bystander-photos` — private, JPEG only, 3 MB per file
--
-- HOW TO APPLY: run this whole file once in the Supabase SQL editor (or psql as the
-- `postgres` role) BEFORE deploying the code on feat/DRRM-008-bystander-report-v2.
-- Prisma selects the new columns, so the old deploy keeps working after this runs but
-- the new deploy does not work before it. The script is idempotent — safe to re-run.
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1 + 2. New columns on bystander_reports ─────────────────────────────────────

ALTER TABLE public.bystander_reports
  ADD COLUMN IF NOT EXISTS contact_number TEXT,
  ADD COLUMN IF NOT EXISTS photo_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  -- Matches the app's normalisation (toPhContactNumber in src/lib/schemas.ts): +63, then a
  -- 9–10 digit national number starting 2–9 (mobile 9XX…, landline area codes 2–8).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bystander_reports_contact_number'
  ) THEN
    ALTER TABLE public.bystander_reports
      ADD CONSTRAINT chk_bystander_reports_contact_number
      CHECK (contact_number IS NULL OR contact_number ~ '^\+63[2-9][0-9]{8,9}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bystander_reports_photo_paths_max'
  ) THEN
    ALTER TABLE public.bystander_reports
      ADD CONSTRAINT chk_bystander_reports_photo_paths_max
      CHECK (cardinality(photo_paths) <= 3);
  END IF;
END $$;

-- 3. Headcount table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bystander_report_population_counts (
  id                  UUID         NOT NULL DEFAULT gen_random_uuid(),
  bystander_report_id UUID         NOT NULL,
  category_id         UUID         NOT NULL,
  count               INTEGER      NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT bystander_report_population_counts_pkey PRIMARY KEY (id),
  CONSTRAINT bystander_report_population_counts_count_check CHECK (count >= 0),
  CONSTRAINT bystander_report_population_counts_bystander_report_id_fkey
    FOREIGN KEY (bystander_report_id) REFERENCES public.bystander_reports (id)
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT bystander_report_population_counts_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.population_categories (id)
    ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- Named explicitly: Prisma's default name would exceed Postgres' 63-character limit.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bystander_pop_counts_report_category
  ON public.bystander_report_population_counts (bystander_report_id, category_id);

-- The app reaches this table only through Prisma as the `postgres` role, which owns it and
-- bypasses RLS. Enabling RLS with no policies keeps it closed to the anon/authenticated
-- keys on the Supabase REST API.
ALTER TABLE public.bystander_report_population_counts ENABLE ROW LEVEL SECURITY;

-- 4. Private photo bucket ─────────────────────────────────────────────────────
-- Uploads and signed URLs go through the server with the service-role key, so the bucket
-- needs no storage.objects policies. The app re-encodes photos to JPEG before upload.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('bystander-photos', 'bystander-photos', false, 3145728, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Check before applying: contact_number is personal data. If bystander_reports has RLS
-- disabled, or a SELECT policy for anon/authenticated, the number becomes readable through
-- the Supabase REST API. This query shows the table's RLS state and policies:
--
--   SELECT relrowsecurity FROM pg_class WHERE oid = 'public.bystander_reports'::regclass;
--   SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'bystander_reports';
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (only if reverting the code too). Photos in the bucket must be deleted first
-- from the Storage dashboard; Supabase does not drop a non-empty bucket.
--
--   BEGIN;
--   DROP TABLE IF EXISTS public.bystander_report_population_counts;
--   ALTER TABLE public.bystander_reports
--     DROP CONSTRAINT IF EXISTS chk_bystander_reports_photo_paths_max,
--     DROP CONSTRAINT IF EXISTS chk_bystander_reports_contact_number,
--     DROP COLUMN IF EXISTS photo_paths,
--     DROP COLUMN IF EXISTS contact_number;
--   DELETE FROM storage.buckets WHERE id = 'bystander-photos';
--   COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
