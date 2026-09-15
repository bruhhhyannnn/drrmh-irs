# [DRRM-003] Fix Plan: Report Form Atomicity & Aggregation Optimization

- **Status:** `[Approved]`
- **Related Bugs / Audits:** [`docs/plan/review/2026-09-08-dev-branch-audit.md`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/review/2026-09-08-dev-branch-audit.md) (§2.1, §3.4, §7.1, §7.2, §7.3)
- **Target Branch / PR:** `fix/report-form-atomicity`
- **Author:** Antigravity

---

## 1. Objective & Scope

Eliminate partial-save vulnerabilities during report submission by converting the multi-RPC mutation blast into a single atomic server transaction. Ensure that selected form cluster/unit values are preserved without being silently overridden by user profile data, encapsulate custom damage condition creation within the report transaction, optimize cluster summary aggregation using Postgres `groupBy`, and fix UI copy typos.

### Non-Goals

- Dropping legacy flat headcount columns from the schema (handled in DRRM-006).
- Reworking the report form layout or step navigation UI.

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [ ] [`src/actions/reports/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/reports/index.ts):
  - **Atomic Nested Updates in `updateReport` (§7.1):** Update `updateReport` to accept nested casualties, missing persons, and population counts, and wrap them in a Prisma transaction (`deleteMany` + `create`):
    ```ts
    export async function updateReport(id: string, data: UpdateReportInput) {
      const { casualties, missing_persons, population_counts, ...reportFields } = data;
      return prisma.$transaction(async (tx) => {
        if (casualties) {
          await tx.reportCasualty.deleteMany({ where: { report_id: id } });
          if (casualties.length > 0) {
            await tx.reportCasualty.createMany({
              data: casualties.map((c) => ({ ...c, report_id: id })),
            });
          }
        }
        if (missing_persons) {
          await tx.reportMissingPerson.deleteMany({ where: { report_id: id } });
          if (missing_persons.length > 0) {
            await tx.reportMissingPerson.createMany({
              data: missing_persons.map((p) => ({ ...p, report_id: id })),
            });
          }
        }
        if (population_counts) {
          await tx.reportPopulationCount.deleteMany({ where: { report_id: id } });
          if (population_counts.length > 0) {
            await tx.reportPopulationCount.createMany({
              data: population_counts.map((p) => ({ ...p, report_id: id })),
            });
          }
        }
        const updated = await tx.report.update({
          where: { id },
          data: reportFields,
        });
        return serializeReport(updated);
      });
    }
    ```
  - **Transactional Custom Damage Condition (§7.3):** If `damage_condition_name` is provided for a new condition, resolve or create it inside the server action transaction before saving the report, avoiding orphan rows on submit failure.
  - **Postgres `groupBy` for Cluster Summary (§2.1):** Replace full in-memory report table download with a database-level query:
    ```ts
    export async function getReportClusterSummary(campusId?: string) {
      const [clusterCounts, clusters] = await Promise.all([
        prisma.report.groupBy({
          by: ['cluster_id'],
          where: campusId ? { cluster: { campus_id: campusId } } : undefined,
          _count: { id: true },
        }),
        prisma.cluster.findMany({
          where: campusId ? { campus_id: campusId } : undefined,
          select: { id: true, name: true },
        }),
      ]);
      // Group casualty and missing person counts per cluster via aggregate/count queries
      // Return structured array matching UI contract
    }
    ```

### 2.2 Frontend / Form Components

- [ ] [`src/app/(admin)/reports/report-form.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/reports/report-form.tsx>):
  - **Remove Profile Override (§7.2):** Change:
    ```ts
    cluster_id: profileClusterId ?? data.cluster_id,
    unit_id: profileUnitId ?? data.unit_id,
    ```
    To:
    ```ts
    cluster_id: data.cluster_id,
    unit_id: data.unit_id,
    ```
    Use `profileClusterId` and `profileUnitId` strictly as form `defaultValues` when initializing the form.
  - **Single Mutation Submission (§7.1):** Remove the 4 subsequent mutation calls (`deleteCasualtyMutation`, `createCasualtyMutation`, `deleteMissingPersonMutation`, `createMissingPersonMutation`). Pass all casualties and missing persons directly inside the payload to `createReportMutation` or `updateReportMutation`.
  - **Clean Up Orphan Pre-Creation (§7.3):** Remove direct pre-submission invocation of `upsertDamageCondition` from the client submit handler.

- [ ] [`src/app/(ert)/report/page.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(ert)/report/page.tsx>):
  - **Typo Fix (§3.4):** Change `"No Damage reported"` in casualty and missing person empty states to `"No Casualties reported"` and `"No Missing Persons reported"` respectively.

---

## 3. Step-by-Step Execution Plan

1. [ ] **Step 1:** Fix UI text typos in [`src/app/(ert)/report/page.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(ert)/report/page.tsx>).
2. [ ] **Step 2:** Refactor `getReportClusterSummary` in [`src/actions/reports/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/reports/index.ts) to push report grouping to Postgres.
3. [ ] **Step 3:** Extend `updateReport` in [`src/actions/reports/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/reports/index.ts) to execute casualty, missing persons, and population count updates atomically inside `prisma.$transaction`.
4. [ ] **Step 4:** Refactor [`src/app/(admin)/reports/report-form.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/reports/report-form.tsx>) submit handler: eliminate multi-RPC promises, pass children in single payload, and respect form cluster selection.
5. [ ] **Step 5:** Invalidate queries and verify server responses.

---

## 4. Testing & Verification

- [ ] Lint check: `npm run lint`
- [ ] Type check: `npm run type-check`
- [ ] Build check: `npm run build`
- [ ] Manual test scenarios:
  1. **Create Report with Casualties & Missing Persons:** Create a report with 2 casualties and 1 missing person. Verify that all records are saved in one server action call.
  2. **Edit Report Relations:** Edit the report: remove 1 casualty and add 1 new missing person. Verify old records are deleted and new ones created atomically.
  3. **Cluster Override Test:** Log in as a user assigned to Cluster A. In the report form, select Cluster B. Submit and verify the created report has `cluster_id` set to Cluster B.
  4. **Cluster Summary Performance:** Load dashboard/reports summary with 50+ reports and verify cluster totals match without excessive memory usage.
