# [DRRM-006] Fix Plan: Schema Normalization & Legacy Dual-Write Sunset

- **Status:** `[Approved]`
- **Related Bugs / Audits:** [`docs/plan/review/2026-09-08-dev-branch-audit.md`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/review/2026-09-08-dev-branch-audit.md) (§4.1, §4.2, §4.3, §4.4, §9.2, §10)
- **Target Branch / PR:** `refactor/schema-dual-write-sunset`
- **Author:** Antigravity

---

## 1. Objective & Scope

Standardize the Prisma schema conventions (PascalCase model names with `@@map`, indexes, and audit timestamps), enforce database integrity via parent check constraints, and execute the final deprecation and removal of the legacy flat headcount columns along with the dual-write shim.

### Prerequisites

- Must be executed **after Waves 1 and 2 (DRRM-001 through DRRM-005) are merged**, because renaming Prisma models regenerates the client types across the codebase.

---

## 2. Technical Solution & Changes Required

### 2.1 Database Schema & Migrations

- [ ] [`prisma/schema.prisma`](file:///C:/Users/jomar/orca/drrmh-irs-dev/prisma/schema.prisma):
  - **PascalCase Model Naming (§4.1):**
    - `model campus` → `model Campus` with `@@map("campuses")`
    - `model bystander_reports` → `model BystanderReport` with `@@map("bystander_reports")`
    - `model bystander_incident_types` → `model BystanderIncidentType` with `@@map("bystander_incident_types")`
    - `model bystander_report_statuses` → `model BystanderReportStatus` with `@@map("bystander_report_statuses")`
  - **Campus Audit Timestamps (§4.2):**
    - Add `created_at DateTime @default(now())`
    - Add `updated_at DateTime @updatedAt`
  - **Add Cluster Index to Bystander Reports (§4.3):**
    - Add `@@index([cluster_id])`
  - **Database Check Constraints (§9.2):**
    - Add custom migration SQL enforcing that casualty and missing person records cannot have both parent IDs null:
      ```sql
      ALTER TABLE report_casualties
        ADD CONSTRAINT chk_report_casualty_has_parent
        CHECK (report_id IS NOT NULL OR bystander_report_id IS NOT NULL);

      ALTER TABLE report_missing_persons
        ADD CONSTRAINT chk_report_missing_person_has_parent
        CHECK (report_id IS NOT NULL OR bystander_report_id IS NOT NULL);
      ```
  - **Drop Legacy Flat Headcount Columns (§4.4, §10):**
    - Remove the 12 flat integer columns from `model Report` (`faculty_members`, `admin_members`, `students`, etc.).

### 2.2 Dual-Write Shim & Read Path Migration

- [ ] **Audit Read Paths (§10):**
  - Verify every component and server action reads exclusively from `report_population_counts`.
  - Update any remaining export utilities to aggregate from `population_counts` instead of flat fields.
- [ ] [`src/lib/utils.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/utils.ts):
  - Delete `mapPopulationCountsToLegacyColumns`.
  - Remove invocation of `mapPopulationCountsToLegacyColumns` in `createReport` and `updateReport`.
- [ ] [`src/lib/constants.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/constants.ts):
  - Remove deprecated `HEADCOUNT_FIELDS` array.

### 2.3 Codebase Prisma Client Updates

- [ ] Update all server actions and hooks referencing the old snake_case Prisma client delegates:
  - `prisma.campus` → `prisma.campus` (with PascalCase model definition)
  - `prisma.bystander_reports` → `prisma.bystanderReport`
  - `prisma.bystander_incident_types` → `prisma.bystanderIncidentType`
  - `prisma.bystander_report_statuses` → `prisma.bystanderReportStatus`

---

## 3. Step-by-Step Execution Plan

1. [ ] **Step 1:** Audit and update all remaining flat-column read paths across the codebase.
2. [ ] **Step 2:** Update [`prisma/schema.prisma`](file:///C:/Users/jomar/orca/drrmh-irs-dev/prisma/schema.prisma) with PascalCase models, `@@map`, indexes, and timestamps.
3. [ ] **Step 3:** Remove the 12 flat columns from `model Report` in `schema.prisma`.
4. [ ] **Step 4:** Generate migration via `npx prisma migrate dev --name schema_normalization_and_dual_write_sunset`.
5. [ ] **Step 5:** Append SQL CHECK constraints to the generated migration file.
6. [ ] **Step 6:** Run `npx prisma generate` and update all server action call sites to match new Prisma delegate names.
7. [ ] **Step 7:** Delete `mapPopulationCountsToLegacyColumns` and `HEADCOUNT_FIELDS`.

---

## 4. Testing & Verification

- [ ] Lint check: `npm run lint`
- [ ] Type check: `npm run type-check`
- [ ] Build check: `npm run build`
- [ ] Database validation:
  1. Inspect DB schema to ensure tables retain plural names (`campuses`, `bystander_reports`) via `@@map`.
  2. Verify foreign key and CHECK constraints reject orphan casualty rows missing parent IDs.
  3. Verify all headcount metrics continue rendering accurately from `report_population_counts`.
