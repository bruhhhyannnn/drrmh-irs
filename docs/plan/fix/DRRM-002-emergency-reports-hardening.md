# [DRRM-002] Fix Plan: Emergency Reports Hardening & Mutation Consistency

- **Status:** `[Approved]`
- **Related Bugs / Audits:** [`docs/plan/review/2026-09-08-dev-branch-audit.md`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/review/2026-09-08-dev-branch-audit.md) (§3.1, §5.1, §5.2, §5.3, §9.3)
- **Target Branch / PR:** `fix/emergency-reports-hardening`
- **Author:** Antigravity

---

## 1. Objective & Scope

Harden the Emergency / Bystander Reports server actions against missing seed records, incorrect cache revalidations, unauthorized administrative mutations, and fragmented coordinate serialization logic.

### Non-Goals

- Modifying the bystander report public submission form layout or UI components.
- Changing database schema or renaming the `bystander_reports` table (scheduled for Track F).

---

## 2. Technical Solution & Changes Required

### 2.1 Shared Helpers

- [ ] [`src/lib/utils.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/utils.ts):
  - Add a generic helper `serializeCoordinates<T extends { latitude: any; longitude: any }>(record: T): T` to convert Prisma `Decimal` lat/lng values safely to standard JavaScript `number`:
    ```ts
    export function serializeCoordinates<T extends { latitude: unknown; longitude: unknown }>(
      record: T
    ): T {
      return {
        ...record,
        latitude:
          typeof record.latitude === 'object' &&
          record.latitude !== null &&
          'toNumber' in record.latitude
            ? (record.latitude as { toNumber: () => number }).toNumber()
            : Number(record.latitude),
        longitude:
          typeof record.longitude === 'object' &&
          record.longitude !== null &&
          'toNumber' in record.longitude
            ? (record.longitude as { toNumber: () => number }).toNumber()
            : Number(record.longitude),
      };
    }
    ```

### 2.2 Server Actions

- [ ] [`src/actions/emergency-reports/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/emergency-reports/index.ts):
  - **Seed Check Guard (§5.1):** In `createBystanderReport`, verify `pendingStatus` exists. If not found, throw an informative error instead of inserting a report with `undefined`/null status:
    ```ts
    if (!pendingStatus) {
      throw new Error('System error: default "pending" status record is missing.');
    }
    ```
  - **Authorization Verification (§5.3):** For `updateBystanderReportStatus` and `deleteBystanderReport`, require caller authentication check or verify an authorized user context before proceeding.
  - **Path Revalidation (§3.1, §5.2):** Standardize cache invalidation using a shared helper:
    ```ts
    const REVALIDATE_ROUTE = '/emergency-reports';
    ```
    Call `revalidatePath(REVALIDATE_ROUTE)` consistently in:
    - `createBystanderReport`
    - `updateBystanderReportStatus` (fixing the typo `revalidatePath('/bystander-reports')`)
    - `deleteBystanderReport`
  - **Coordinate Normalization (§9.3):** Use `serializeCoordinates` in `createBystanderReport`, `getBystanderReports`, and `updateBystanderReportStatus`.

### 2.3 Query Hooks

- [ ] [`src/app/(admin)/emergency-reports/use-bystander-reports.ts`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/emergency-reports/use-bystander-reports.ts>):
  - Verify query invalidations match the server action updates and ensure error handling displays friendly error messages from server rejections.

---

## 3. Step-by-Step Execution Plan

1. [ ] **Step 1:** Implement `serializeCoordinates` utility in [`src/lib/utils.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/utils.ts).
2. [ ] **Step 2:** In [`src/actions/emergency-reports/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/emergency-reports/index.ts), guard `pendingStatus` lookup to throw if missing.
3. [ ] **Step 3:** Correct `revalidatePath` call in `updateBystanderReportStatus` from `'/bystander-reports'` to `'/emergency-reports'` and add revalidation to `createBystanderReport`.
4. [ ] **Step 4:** Replace repeated `.toNumber()` mappings with `serializeCoordinates`.
5. [ ] **Step 5:** Add authorization verification on mutating admin actions (`updateBystanderReportStatus`, `deleteBystanderReport`).

---

## 4. Testing & Verification

- [ ] Lint check: `npm run lint`
- [ ] Type check: `npm run type-check`
- [ ] Build check: `npm run build`
- [ ] Manual test scenarios:
  1. **Emergency Report Creation:** Submit a new emergency report from the public form. Verify it is saved with `pending` status and coordinates as numbers.
  2. **Admin Status Update:** From `/emergency-reports`, update the status of a report (e.g., to "reviewed" or "verified"). Verify the list refreshes automatically without needing a browser reload.
  3. **Unauthorized Mutation Attempt:** Attempt status change without valid credentials; verify action fails cleanly.
