-- ─────────────────────────────────────────────────────────────────────────────
-- DRRM-015 · MATATAG building assessment
-- Plan: docs/plan/feature/DRRM-015-assessment-form.md
--
-- Adds the versioned checklist and the assessments made with it:
--   1. Lookups: building_area_types, drrm_pillars
--   2. Question bank: assessment_templates → assessment_template_versions →
--      assessment_sections → assessment_items (sub-items through parent_id)
--   3. Buildings: buildings (under a unit) and building_areas (its current profile)
--   4. Assessments: assessments, assessment_areas (the profile on the day),
--      assessment_answers, assessment_pillar_scores (snapshot at submit),
--      assessment_section_comments
--
-- HOW TO APPLY:
--   * Test database (this worktree's .env.development.local), from the repo root in bash. Use
--     the direct connection (DIRECT_URL, port 5432): `db execute` hangs on the pooler (6543).
--       DATABASE_URL="$(grep -E '^DIRECT_URL=' .env.development.local | cut -d= -f2- | tr -d '"')" \
--         node --env-file=.env.development.local node_modules/prisma/build/index.js \
--         db execute --file prisma/manual/DRRM-015-assessment.sql
--   * Production: run this whole file once in the Supabase SQL editor (or psql as the
--     `postgres` role), then `npm run seed:matatag`, BEFORE deploying the code on
--     feat/DRRM-015-assessment-form. Only new tables are added, so the old deploy keeps
--     working after this runs. The script is idempotent — safe to re-run.
--
-- Do NOT apply it with `prisma db push` / `prisma migrate` (see CLAUDE.md).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Enums ───────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_answer') THEN
    CREATE TYPE public.assessment_answer AS ENUM ('yes', 'no', 'na');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_safe_answer') THEN
    CREATE TYPE public.assessment_safe_answer AS ENUM ('yes', 'no');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_version_status') THEN
    CREATE TYPE public.assessment_version_status AS ENUM ('draft', 'published', 'retired');
  END IF;
END $$;

-- 1. Lookups ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.building_area_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  name_en    TEXT NOT NULL,
  name_fil   TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The four DRRM pillars (RA 10121); codes are the slugs of PILLARS in src/lib/pillars.ts.
CREATE TABLE IF NOT EXISTS public.drrm_pillars (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Question bank ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.assessment_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_template_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID NOT NULL REFERENCES public.assessment_templates (id) ON DELETE NO ACTION,
  label        TEXT NOT NULL,
  status       public.assessment_version_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_by   UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_sections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id   UUID NOT NULL REFERENCES public.assessment_template_versions (id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  title_en     TEXT NOT NULL,
  title_fil    TEXT NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  -- Set: the whole section needs that area (VII, IX, XI–XVII).
  area_type_id UUID REFERENCES public.building_area_types (id) ON DELETE NO ACTION,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A group parent (I.3, III.2, IV.1 …) has is_scored = false and holds the shared prompt; its
-- sub-items are scored. Every scored item has a pillar; group parents don't.
CREATE TABLE IF NOT EXISTS public.assessment_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id   UUID NOT NULL REFERENCES public.assessment_sections (id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES public.assessment_items (id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  prompt_en    TEXT NOT NULL,
  prompt_fil   TEXT NOT NULL,
  note_en      TEXT,
  note_fil     TEXT,
  reference    TEXT,
  is_scored    BOOLEAN NOT NULL DEFAULT TRUE,
  safe_answer  public.assessment_safe_answer NOT NULL DEFAULT 'yes',
  area_type_id UUID REFERENCES public.building_area_types (id) ON DELETE NO ACTION,
  min_floors   INT,
  flag_label   TEXT,
  pillar_id    UUID REFERENCES public.drrm_pillars (id) ON DELETE NO ACTION,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Buildings ────────────────────────────────────────────────────────────────

-- Campus and cluster come through the unit. A building shared by several units is listed under
-- its main one. floor_count and building_areas are the current profile, used to pre-fill.
CREATE TABLE IF NOT EXISTS public.buildings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     UUID NOT NULL REFERENCES public.units (id) ON DELETE NO ACTION,
  name        TEXT NOT NULL,
  floor_count INT NOT NULL DEFAULT 1,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.building_areas (
  building_id  UUID NOT NULL REFERENCES public.buildings (id) ON DELETE CASCADE,
  area_type_id UUID NOT NULL REFERENCES public.building_area_types (id) ON DELETE NO ACTION,
  PRIMARY KEY (building_id, area_type_id)
);

-- 4. Assessments ──────────────────────────────────────────────────────────────

-- client_ref is the draft's id on the phone, so an offline replay that already landed isn't
-- inserted twice. floor_count and assessment_areas are what was true on the day.
CREATE TABLE IF NOT EXISTS public.assessments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_ref          UUID NOT NULL UNIQUE,
  template_version_id UUID NOT NULL REFERENCES public.assessment_template_versions (id) ON DELETE NO ACTION,
  building_id         UUID NOT NULL REFERENCES public.buildings (id) ON DELETE NO ACTION,
  event_id            UUID REFERENCES public.events (id) ON DELETE SET NULL,
  evaluator_id        UUID NOT NULL REFERENCES public.users (id) ON DELETE NO ACTION,
  incident_commander  TEXT NOT NULL DEFAULT '',
  floor_count         INT NOT NULL,
  started_at          TIMESTAMPTZ NOT NULL,
  ended_at            TIMESTAMPTZ NOT NULL,
  needs_follow_up     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_areas (
  assessment_id UUID NOT NULL REFERENCES public.assessments (id) ON DELETE CASCADE,
  area_type_id  UUID NOT NULL REFERENCES public.building_area_types (id) ON DELETE NO ACTION,
  PRIMARY KEY (assessment_id, area_type_id)
);

-- A scored item always has an answer (enforced in createAssessment); a group parent can carry
-- remarks only, like the paper's "Remarks:" under group questions.
CREATE TABLE IF NOT EXISTS public.assessment_answers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments (id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES public.assessment_items (id) ON DELETE NO ACTION,
  answer        public.assessment_answer,
  remarks       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Written once at submit, four rows per assessment (zeros allowed). Counts, not percentages, so
-- campus rollups can add them up; the overall score is the sum of the four rows.
CREATE TABLE IF NOT EXISTS public.assessment_pillar_scores (
  assessment_id UUID NOT NULL REFERENCES public.assessments (id) ON DELETE CASCADE,
  pillar_id     UUID NOT NULL REFERENCES public.drrm_pillars (id) ON DELETE NO ACTION,
  safe_count    INT NOT NULL DEFAULT 0,
  counted_count INT NOT NULL DEFAULT 0,
  na_count      INT NOT NULL DEFAULT 0,
  PRIMARY KEY (assessment_id, pillar_id)
);

CREATE TABLE IF NOT EXISTS public.assessment_section_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments (id) ON DELETE CASCADE,
  section_id    UUID NOT NULL REFERENCES public.assessment_sections (id) ON DELETE NO ACTION,
  comment       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraints ─────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_template_versions_label') THEN
    ALTER TABLE public.assessment_template_versions
      ADD CONSTRAINT uq_template_versions_label UNIQUE (template_id, label);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_assessment_sections_code') THEN
    ALTER TABLE public.assessment_sections
      ADD CONSTRAINT uq_assessment_sections_code UNIQUE (version_id, code);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessment_items_pillar') THEN
    ALTER TABLE public.assessment_items
      ADD CONSTRAINT chk_assessment_items_pillar
      CHECK ((is_scored AND pillar_id IS NOT NULL) OR (NOT is_scored AND pillar_id IS NULL));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessment_items_min_floors') THEN
    ALTER TABLE public.assessment_items
      ADD CONSTRAINT chk_assessment_items_min_floors CHECK (min_floors IS NULL OR min_floors >= 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_buildings_floor_count') THEN
    ALTER TABLE public.buildings
      ADD CONSTRAINT chk_buildings_floor_count CHECK (floor_count >= 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessments_floor_count') THEN
    ALTER TABLE public.assessments
      ADD CONSTRAINT chk_assessments_floor_count CHECK (floor_count >= 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessments_times') THEN
    ALTER TABLE public.assessments
      ADD CONSTRAINT chk_assessments_times CHECK (ended_at >= started_at);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_assessment_answers_item') THEN
    ALTER TABLE public.assessment_answers
      ADD CONSTRAINT uq_assessment_answers_item UNIQUE (assessment_id, item_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessment_answers_content') THEN
    ALTER TABLE public.assessment_answers
      ADD CONSTRAINT chk_assessment_answers_content CHECK (answer IS NOT NULL OR remarks IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_assessment_pillar_scores_counts'
  ) THEN
    ALTER TABLE public.assessment_pillar_scores
      ADD CONSTRAINT chk_assessment_pillar_scores_counts
      CHECK (0 <= safe_count AND safe_count <= counted_count AND na_count >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_assessment_section_comments_section'
  ) THEN
    ALTER TABLE public.assessment_section_comments
      ADD CONSTRAINT uq_assessment_section_comments_section UNIQUE (assessment_id, section_id);
  END IF;
END $$;

-- Indexes ─────────────────────────────────────────────────────────────────────

-- One published version per template.
CREATE UNIQUE INDEX IF NOT EXISTS uq_template_versions_one_published
  ON public.assessment_template_versions (template_id)
  WHERE status = 'published';

-- Top-level items have no parent; COALESCE makes them unique too on any Postgres version.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_items_code
  ON public.assessment_items (
    section_id,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    code
  );

CREATE INDEX IF NOT EXISTS idx_assessment_items_section_order
  ON public.assessment_items (section_id, sort_order);

-- Two people adding "Annex" and "annex" to the same unit get one building.
CREATE UNIQUE INDEX IF NOT EXISTS uq_buildings_unit_name
  ON public.buildings (unit_id, lower(name));

-- Latest assessment per building.
CREATE INDEX IF NOT EXISTS idx_assessments_building_ended
  ON public.assessments (building_id, ended_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessments_evaluator
  ON public.assessments (evaluator_id);

-- Row level security ──────────────────────────────────────────────────────────

-- The app reaches these tables only through Prisma as the `postgres` role, which owns them and
-- bypasses RLS. Enabling RLS with no policies keeps them closed to the anon/authenticated keys
-- on the Supabase REST API.
ALTER TABLE public.building_area_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drrm_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_pillar_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_section_comments ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (only if reverting the code too; deletes every assessment):
--
--   BEGIN;
--   DROP TABLE IF EXISTS public.assessment_section_comments;
--   DROP TABLE IF EXISTS public.assessment_pillar_scores;
--   DROP TABLE IF EXISTS public.assessment_answers;
--   DROP TABLE IF EXISTS public.assessment_areas;
--   DROP TABLE IF EXISTS public.assessments;
--   DROP TABLE IF EXISTS public.building_areas;
--   DROP TABLE IF EXISTS public.buildings;
--   DROP TABLE IF EXISTS public.assessment_items;
--   DROP TABLE IF EXISTS public.assessment_sections;
--   DROP TABLE IF EXISTS public.assessment_template_versions;
--   DROP TABLE IF EXISTS public.assessment_templates;
--   DROP TABLE IF EXISTS public.drrm_pillars;
--   DROP TABLE IF EXISTS public.building_area_types;
--   DROP TYPE IF EXISTS public.assessment_version_status;
--   DROP TYPE IF EXISTS public.assessment_safe_answer;
--   DROP TYPE IF EXISTS public.assessment_answer;
--   COMMIT;
-- ─────────────────────────────────────────────────────────────────────────────
