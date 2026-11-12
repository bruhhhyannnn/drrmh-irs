-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-036 · Campus logo upload
-- Plan: docs/plan/feature/DRRM-036-campus-page-hub-logo-upload.md
--
-- Lets super admins upload a campus logo from Add campus / Edit campus:
--   1. campus.logo_path   — the logo's path in the bucket (null: the bundled logo or the UP seal)
--   2. Storage bucket `campus-logos` — public, PNG / WebP only, 1 MB per file
--
-- HOW TO APPLY: run this whole file once in the Supabase SQL editor (or psql as the
-- `postgres` role) on every database the code runs against (staging and production). The
-- code works before it runs (logos fall back to the bundled ones and uploads say the update
-- is missing), so the order doesn't matter. The script is idempotent — safe to re-run.
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Logo column ───────────────────────────────────────────────────────────────

ALTER TABLE public.campus
  ADD COLUMN IF NOT EXISTS logo_path TEXT;

-- 2. Public logo bucket ────────────────────────────────────────────────────────
-- Logos are public (they show on the sign-in-free bystander form too). Uploads and deletes go
-- through the server with the service-role key, so the bucket needs no storage.objects
-- policies. The browser scales logos to 512 × 512 PNG or WebP before upload.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('campus-logos', 'campus-logos', true, 1048576, ARRAY['image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

COMMIT;
