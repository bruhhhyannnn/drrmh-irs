# [DRRM-004] Fix Plan: Events, Dynamic Clusters & Query Optimization

- **Status:** `[Approved]`
- **Related Bugs / Audits:** [`docs/plan/review/2026-09-08-dev-branch-audit.md`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/review/2026-09-08-dev-branch-audit.md) (§1.1, §1.4, §1.5, §2.2, §2.4, §2.5, §3.3, §9.5)
- **Target Branch / PR:** `fix/events-dynamic-clusters`
- **Author:** Antigravity

---

## 1. Objective & Scope

Fix database constraint failures on user deletion when events exist, replace hardcoded cluster constants with dynamic cluster resolution across event summaries and Excel exports, rectify landing page event metrics, collapse redundant sequential database roundtrips, and clean up dead schema definitions.

### Non-Goals

- Modifying the underlying database schema structure of events (handled in DRRM-006).
- Altering the visual design of event detail pages.

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [ ] [`src/actions/users/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/users/index.ts):
  - In `deleteUser(id)`, nullify `event.user_id` alongside `report.user_id` before deleting the user record (§1.1):
    ```ts
    await prisma.event.updateMany({ where: { user_id: id }, data: { user_id: null } });
    await prisma.report.updateMany({ where: { user_id: id }, data: { user_id: null } });
    await prisma.user.delete({ where: { id } });
    ```

- [ ] [`src/actions/landing/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/landing/index.ts):
  - In `getLandingData`, add a direct database count query for active events (§1.5):
    ```ts
    const [events, totalEvents, activeEvents] = await Promise.all([
      prisma.event.findMany({ ...options, take: 8 }),
      prisma.event.count(),
      prisma.event.count({
        where: { status: { name: { equals: 'ongoing', mode: 'insensitive' } } },
      }),
    ]);
    return { totalEvents, activeEvents, events };
    ```

- [ ] [`src/actions/campus-table/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/campus-table/index.ts):
  - **Collapse N+1 Roundtrips (§2.2):** In `getCampusHeadcountPerEvent`, include `cluster` (with `campus`) and `unit` directly in the `prisma.report.findMany` query instead of issuing 3 sequential queries.
  - **Merge Sequential Status Queries (§2.5):** In `getCampusEvents`, fetch all events in one query and sort completed vs non-completed in JavaScript memory rather than making 3 sequential roundtrips.

- [ ] [`src/actions/events/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/events/index.ts) & [`src/actions/reports/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/reports/index.ts):
  - **Single Query Status Lookup (§2.4):** In `getOngoingEvents` and `getMyReportForOngoingEvent`, query through the relation filter directly (`status: { name: { equals: 'ongoing', mode: 'insensitive' } }`) rather than first finding `EventStatus` and querying again with its ID.

### 2.2 Frontend & Export Logic

- [ ] [`src/app/(admin)/events/details/event-summary.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/events/details/event-summary.tsx>):
  - Derive clusters dynamically from the actual event report dataset or campus clusters instead of iterating over the frozen `CLUSTERS` constant (§1.4).

- [ ] [`src/app/(admin)/events/export-event.ts`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/events/export-event.ts>):
  - Dynamically extract cluster names from reports (`[...new Set(reports.map(r => r.cluster.name))].sort()`) when generating the "By Cluster" export sheet (§1.4).

- [ ] [`src/app/(admin)/events/details/page.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/events/details/page.tsx>):
  - Normalize event status comparison to lowercase (`event.status.name.toLowerCase() === 'ongoing'`) when rendering status badge colors (§3.3).

### 2.3 Schema Validation

- [ ] [`src/lib/schemas.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/schemas.ts):
  - Remove dead `location_id` field from `eventSchema` (§9.5).

---

## 3. Step-by-Step Execution Plan

1. [ ] **Step 1:** Fix `deleteUser` in [`src/actions/users/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/users/index.ts) to nullify `event.user_id`.
2. [ ] **Step 2:** Fix `getLandingData` in [`src/actions/landing/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/landing/index.ts) to execute a true `count()`.
3. [ ] **Step 3:** Optimize queries in [`src/actions/campus-table/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/campus-table/index.ts) and [`src/actions/events/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/events/index.ts).
4. [ ] **Step 4:** Replace static `CLUSTERS` in [`event-summary.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/events/details/event-summary.tsx>) and [`export-event.ts`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/events/export-event.ts>).
5. [ ] **Step 5:** Normalize badge casing in [`src/app/(admin)/events/details/page.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/events/details/page.tsx>) and clean up `eventSchema` in [`src/lib/schemas.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/schemas.ts).

---

## 4. Testing & Verification

- [ ] Lint check: `npm run lint`
- [ ] Type check: `npm run type-check`
- [ ] Build check: `npm run build`
- [ ] Manual test scenarios:
  1. **User Deletion with Events:** Create an event as an admin, then delete the user. Verify deletion succeeds and `event.user_id` becomes `null`.
  2. **Landing Page Stat:** Create 10 events where the 9th is "Ongoing". Verify landing card shows the accurate active event count.
  3. **Custom Cluster Export:** Add a custom cluster (e.g. "SHS Baler") with reports. Export event to Excel; verify the new cluster appears in the breakdown sheet.
