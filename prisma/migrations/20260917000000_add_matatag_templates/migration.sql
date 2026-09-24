-- Published definitions are immutable so existing assessments keep their questions and scoring.
CREATE TABLE "matatag_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  "definition" JSONB NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "matatag_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "matatag_templates_revision_key" UNIQUE ("revision")
);
-- Reads and Super Admin-only publishing go through server actions.
ALTER TABLE "matatag_templates" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "matatag_templates" FROM anon, authenticated;
