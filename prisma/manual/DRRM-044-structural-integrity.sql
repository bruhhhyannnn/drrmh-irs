-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-044 · Structural integrity in the building assessment
-- Plan: docs/plan/feature/DRRM-044-structural-integrity.md
--
-- The assessment form gains the Rapid Condition Assessment Tool (RCAsT), Material Component:
-- ten defect types checked on columns, beams, floor slabs and walls, each graded by how bad and
-- how widespread it is, and a condition rating worked out from them.
--   1. assessment_structural_summaries — one row per assessment that has the checks: the
--      ratings, the critical-crack answers and the recommendation, written once at submit
--   2. assessment_structural_findings — one row per element and defect
--
-- HOW TO APPLY: run this whole file once in the Supabase SQL editor (or psql as the
-- `postgres` role) on every database the code runs against (staging and production), BEFORE
-- deploying the code. Until it runs, older assessments still open (without a structural part)
-- but a new assessment is refused with a message that this update is missing. The script only
-- adds two tables and is idempotent — safe to re-run.
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.assessment_structural_summaries (
  assessment_id    UUID PRIMARY KEY
                   REFERENCES public.assessments (id) ON DELETE CASCADE,
  -- Which edition of the tool's questions and formula (STRUCTURAL_TOOL_VERSION).
  tool_version     TEXT NOT NULL,
  -- Condition ratings in percent; higher means more deterioration.
  lcr_columns      DOUBLE PRECISION NOT NULL DEFAULT 0,
  lcr_beams        DOUBLE PRECISION NOT NULL DEFAULT 0,
  lcr_slabs        DOUBLE PRECISION NOT NULL DEFAULT 0,
  lcr_walls        DOUBLE PRECISION NOT NULL DEFAULT 0,
  gcr              DOUBLE PRECISION NOT NULL DEFAULT 0,
  critical_columns public.assessment_answer,
  critical_beams   public.assessment_answer,
  critical_walls   public.assessment_answer,
  recommendation   TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_structural_summaries_recommendation
    CHECK (recommendation IN ('none', 'local', 'overall')),
  CONSTRAINT chk_structural_summaries_ratings
    CHECK (lcr_columns >= 0 AND lcr_beams >= 0 AND lcr_slabs >= 0 AND lcr_walls >= 0 AND gcr >= 0)
);

CREATE TABLE IF NOT EXISTS public.assessment_structural_findings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL
                REFERENCES public.assessments (id) ON DELETE CASCADE,
  element       TEXT NOT NULL,
  -- The form's row number, '1.1' to '2.2'.
  defect_code   TEXT NOT NULL,
  answer        public.assessment_answer NOT NULL,
  -- 1 to 4 on the tool's scales (K2 and K3 = 0.5, 1, 1.5, 2); set only when the answer is yes.
  severity      SMALLINT,
  extent        SMALLINT,
  remarks       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_structural_findings_check UNIQUE (assessment_id, element, defect_code),
  CONSTRAINT chk_structural_findings_element
    CHECK (element IN ('columns', 'beams', 'slabs', 'walls')),
  CONSTRAINT chk_structural_findings_grades
    CHECK (
      (answer = 'yes' AND severity BETWEEN 1 AND 4 AND extent BETWEEN 1 AND 4)
      OR (answer <> 'yes' AND severity IS NULL AND extent IS NULL)
    )
);

-- Row level security ──────────────────────────────────────────────────────────

-- As with the other assessment tables: reached only through Prisma as the `postgres` role, so
-- RLS with no policies keeps them closed to the anon/authenticated keys on the REST API.
ALTER TABLE public.assessment_structural_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_structural_findings ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (only if reverting the code too; deletes every structural answer):
--
--   BEGIN;
--   DROP TABLE IF EXISTS public.assessment_structural_findings;
--   DROP TABLE IF EXISTS public.assessment_structural_summaries;
--   COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
