CREATE TABLE "matatag_assessments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE NO ACTION,
  "campus_id" UUID NOT NULL REFERENCES "campus"("id") ON DELETE NO ACTION,
  "building" TEXT NOT NULL,
  "evaluator" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'COMPLETED')),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "document" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "matatag_assessments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "matatag_assessments_campus_id_updated_at_idx" ON "matatag_assessments"("campus_id", "updated_at");
CREATE INDEX "matatag_assessments_user_id_updated_at_idx" ON "matatag_assessments"("user_id", "updated_at");

-- All access is through authenticated, campus-scoped server actions using Prisma.
-- No direct browser/PostgREST access to assessment records.
ALTER TABLE "matatag_assessments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "matatag_assessments" FROM anon, authenticated;
