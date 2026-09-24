CREATE TABLE "matatag_forms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campus_id" UUID NOT NULL REFERENCES "campus"("id") ON DELETE NO ACTION,
  "title" TEXT NOT NULL,
  "is_open" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE NO ACTION,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "matatag_forms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "matatag_forms_campus_id_updated_at_idx" ON "matatag_forms"("campus_id", "updated_at");

ALTER TABLE "matatag_templates" ADD COLUMN "form_id" UUID REFERENCES "matatag_forms"("id") ON DELETE NO ACTION;
ALTER TABLE "matatag_templates" DROP CONSTRAINT "matatag_templates_revision_key";
CREATE UNIQUE INDEX "matatag_templates_form_id_revision_key" ON "matatag_templates"("form_id", "revision");
-- NULL form_id denotes the shared default template; its revisions must also be unique.
CREATE UNIQUE INDEX "matatag_templates_default_revision_key" ON "matatag_templates"("revision") WHERE "form_id" IS NULL;

ALTER TABLE "matatag_assessments" ADD COLUMN "form_id" UUID REFERENCES "matatag_forms"("id") ON DELETE NO ACTION;
CREATE INDEX "matatag_assessments_form_id_updated_at_idx" ON "matatag_assessments"("form_id", "updated_at");

ALTER TABLE "matatag_forms" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "matatag_forms" FROM anon, authenticated;
