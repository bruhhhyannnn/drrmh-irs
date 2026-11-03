-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-022 · Photos on field reports
-- Plan: docs/plan/feature/DRRM-022-report-photos.md
--
-- Lets ERT members attach photos to a status report:
--   1. reports.damage_photo_paths   — up to 3 photos of the structural damage
--   2. report_casualties.photo_paths — up to 3 photos of a casualty's injury (admin-only)
--   3. Storage bucket `report-photos` — private, JPEG only, 1.5 MB per file
--
-- HOW TO APPLY: run this whole file once in the Supabase SQL editor (or psql as the
-- `postgres` role) BEFORE deploying the code on feat/DRRM-022-report-photos, on every
-- database the code will run against (staging and production). Prisma selects the new
-- columns, so the old deploy keeps working after this runs but the new deploy does not
-- work before it. The script is idempotent — safe to re-run.
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1 + 2. Photo columns ────────────────────────────────────────────────────────

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS damage_photo_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.report_casualties
  ADD COLUMN IF NOT EXISTS photo_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  -- REPORT_MAX_PHOTOS in src/lib/constants.ts.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_reports_damage_photo_paths_max'
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT chk_reports_damage_photo_paths_max
      CHECK (cardinality(damage_photo_paths) <= 3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_report_casualties_photo_paths_max'
  ) THEN
    ALTER TABLE public.report_casualties
      ADD CONSTRAINT chk_report_casualties_photo_paths_max
      CHECK (cardinality(photo_paths) <= 3);
  END IF;
END $$;

-- 3. Private photo bucket ─────────────────────────────────────────────────────
-- Uploads, signed URLs and deletes go through the server with the service-role key, so the
-- bucket needs no storage.objects policies. The phone re-encodes photos to ~1280px JPEGs
-- before upload, well under the limit.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('report-photos', 'report-photos', false, 1572864, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Check before applying: casualty photos are health information about identifiable people.
-- If report_casualties has RLS disabled, or a SELECT policy for anon/authenticated, the photo
-- paths become readable through the Supabase REST API (the photos themselves stay private:
-- the bucket has no policies). This query shows the table's RLS state and policies:
--
--   SELECT relrowsecurity FROM pg_class WHERE oid = 'public.report_casualties'::regclass;
--   SELECT policyname, roles, cmd FROM pg_policies WHERE tablename = 'report_casualties';
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (only if reverting the code too). Photos in the bucket must be deleted first
-- from the Storage dashboard; Supabase does not drop a non-empty bucket.
--
--   BEGIN;
--   ALTER TABLE public.report_casualties
--     DROP CONSTRAINT IF EXISTS chk_report_casualties_photo_paths_max,
--     DROP COLUMN IF EXISTS photo_paths;
--   ALTER TABLE public.reports
--     DROP CONSTRAINT IF EXISTS chk_reports_damage_photo_paths_max,
--     DROP COLUMN IF EXISTS damage_photo_paths;
--   DELETE FROM storage.buckets WHERE id = 'report-photos';
--   COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
