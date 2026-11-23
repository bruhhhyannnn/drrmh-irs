-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-049 · A shared counter for the public bystander form's per-network limit
-- Plan: docs/plan/fix/DRRM-049-hardening.md · GitHub #104
--
-- createBystanderReport (the QR form) is public and takes photos, so each network may send at
-- most 30 reports per 10 minutes (src/lib/rate-limit.ts). The count has to be shared by every
-- server copy, so it lives here: one row per client, keyed by a salted SHA-256 of its IP (the
-- IP itself is never stored). Rows not seen for a day are deleted by the app now and then.
--
-- HOW TO APPLY: run this whole file once in the Supabase SQL editor (or psql as the `postgres`
-- role) on staging and production. The code works without it: until it runs, each server copy
-- counts on its own. It is idempotent: safe to re-run.
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key           TEXT PRIMARY KEY,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits          INTEGER NOT NULL DEFAULT 0 CHECK (hits >= 0)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits (window_start);

-- Reached only through Prisma as `postgres`; closed to the REST API keys.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (the limit then counts per server copy again):
--
--   DROP TABLE IF EXISTS public.rate_limits;
-- ─────────────────────────────────────────────────────────────────────────────
