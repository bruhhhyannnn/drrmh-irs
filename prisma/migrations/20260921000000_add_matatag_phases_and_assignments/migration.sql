ALTER TABLE "matatag_forms"
  ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'PRE',
  ADD COLUMN "access_mode" TEXT NOT NULL DEFAULT 'CAMPUS';

ALTER TABLE "matatag_forms"
  ADD CONSTRAINT "matatag_forms_phase_check" CHECK ("phase" IN ('PRE', 'POST')),
  ADD CONSTRAINT "matatag_forms_access_mode_check" CHECK ("access_mode" IN ('CAMPUS', 'ASSIGNED'));

CREATE TABLE "matatag_form_assignments" (
  "form_id" UUID NOT NULL REFERENCES "matatag_forms"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE NO ACTION,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "matatag_form_assignments_pkey" PRIMARY KEY ("form_id", "user_id")
);

CREATE INDEX "matatag_form_assignments_user_id_idx"
  ON "matatag_form_assignments"("user_id");

ALTER TABLE "matatag_assessments"
  ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'PRE';

ALTER TABLE "matatag_assessments"
  ADD CONSTRAINT "matatag_assessments_phase_check" CHECK ("phase" IN ('PRE', 'POST'));
