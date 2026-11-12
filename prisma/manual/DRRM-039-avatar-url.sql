-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-039 · Google profile photos
-- Plan: docs/plan/feature/DRRM-039-google-profile-photos.md
--
-- Admin pages show members' Google profile photos:
--   1. users.avatar_url  — the photo URL from the verified Google session, refreshed at sign-in
--                          (null for email-and-password and off-campus accounts)
--   2. users.show_avatar — "Show my Google photo" in My profile (on by default)
-- The images are not copied into Storage; they load from Google.
--
-- HOW TO APPLY: run this whole file once in the Supabase SQL editor (or psql as the
-- `postgres` role) on every database the code runs against (staging and production). The code
-- works before it runs (initials show and nothing is saved), so the order doesn't matter. The
-- script is idempotent — safe to re-run.
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_avatar BOOLEAN NOT NULL DEFAULT TRUE;

COMMIT;
