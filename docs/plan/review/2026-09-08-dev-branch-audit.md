# Code Review & Audit Findings — `dev` Branch

- **Date:** 2026-09-08
- **Branch:** `dev`
- **Reviewer:** Antigravity (automated deep-read audit)
- **Scope:** Architecture, correctness, security, database performance, state synchronization, type safety, and code quality.
- **Status:** `[Approved for Action Planning]`

---

## Table of Contents

1. [Critical & High-Risk Bugs](#1-critical--high-risk-bugs)
2. [Performance & Database Optimizations](#2-performance--database-optimizations)
3. [Cache & Route Fixes](#3-cache--route-fixes)
4. [Schema Design Issues](#4-schema-design-issues)
5. [Emergency Reports — Additional Bugs](#5-emergency-reports--additional-bugs)
6. [Settings Actions — Structural Weaknesses](#6-settings-actions--structural-weaknesses)
7. [Report Form — Atomicity & Correctness](#7-report-form--atomicity--correctness)
8. [Auth Flow — Detailed Analysis](#8-auth-flow--detailed-analysis)
9. [Type Safety & Code Quality](#9-type-safety--code-quality)
10. [Legacy Dual-Write Shim Risk](#10-legacy-dual-write-shim-risk)
11. [Prioritized Remediation Checklist](#11-prioritized-remediation-checklist)

---

## 1. Critical & High-Risk Bugs

### 1.1 Foreign Key Constraint Violation on User Deletion

- **File:** [`src/actions/users/index.ts:182-200`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/users/index.ts#L182-L200)
- **Problem:** `deleteUser(id)` nullifies `report.user_id` but neglects `event.user_id`. In `schema.prisma`, `Event.user` is declared with `onDelete: NoAction`:
  ```prisma
  user User? @relation("CreatedBy", fields: [user_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  ```
  When the user has created events, Postgres will reject the `DELETE` with error `P2003`.
- **Impact:** Any user who has ever created an event cannot be deleted. The error surfaces to the UI as a confusing generic message.
- **Fix:**
  ```ts
  // Nullify both relations before deleting the user
  await prisma.event.updateMany({ where: { user_id: id }, data: { user_id: null } });
  await prisma.report.updateMany({ where: { user_id: id }, data: { user_id: null } });
  await prisma.user.delete({ where: { id } });
  ```
- **Alternative (schema-level):** Change `Event.user` to `onDelete: SetNull` in the Prisma schema and generate a migration; this guarantees consistency at the DB level without application-code dependency.

---

### 1.2 Google OAuth User Linking Failure on Existing Accounts

- **File:** [`src/actions/auth/index.ts:53-67`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/auth/index.ts#L53-L67)
- **Problem:** When a `P2002` (unique email violation) is caught, the code retrieves `byEmail` but only returns `{ userTypeName }` — it never writes `auth_id` to the found user row. The subsequent `getUserByAuthId(userId)` call in `AuthProvider` will return `null` because the DB row still holds the old `auth_id`.
- **Impact:** Users logging in with Google for the first time on a pre-existing email-based account will silently get a broken session — `userProfile` will be `null` — and will be stuck in a loading spinner indefinitely.
- **Secondary issue:** There is also a **race condition**: two near-simultaneous Google sign-ins with the same email could both miss the `findUnique` on `auth_id` and both attempt `prisma.user.create`, causing the `P2002` on one; the catch path then runs, but the `findFirst` and `update` are not wrapped in a transaction, so a partial failure could leave the row in an inconsistent state.
- **Fix:**
  ```ts
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { auth_id: authId },
    });
    return { userTypeName: byEmail.user_type.name };
  }
  ```
  Or, better — use `prisma.$transaction` and an `upsert` keyed on email to make the entire operation atomic.

---

### 1.3 Stale LocalStorage Auth Profile & Account Switching Bug

- **Files:** [`src/store/auth.store.ts:57-61`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/store/auth.store.ts#L57-L61), [`src/components/auth/auth-provider.tsx:40-56`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/auth/auth-provider.tsx#L40-L56)
- **Problem:** `useAuthStore` persists `userProfile` to `localStorage` under the key `irs-auth`:
  ```ts
  partialize: (state) => ({ userProfile: state.userProfile }),
  ```
  `fetchProfile()` skips the network call entirely if `userProfile !== null`:
  ```ts
  if (userProfile !== null) {
    setLoading(false);
    return;
  }
  ```
- **Impact:**
  1. **Stale permissions:** An admin who changes a user's role, cluster, or deactivates their account will see no effect until that user manually clears `localStorage`. The `ProtectedRoute` will render the old role, potentially allowing access to pages the user should no longer see.
  2. **Account switching:** If user A logs out and user B logs in on the same browser, `userProfile` from localStorage still belongs to A. The early-return guard does not check `userProfile.auth_id === session.user.id`, so B sees A's profile data until a hard refresh.
  3. **`lastUserIdRef`** is declared but **never written to** when a profile is fetched. The ref serves no de-duplication purpose as currently written.
- **Fix:**
  ```ts
  async function fetchProfile(userId: string) {
    const { userProfile } = useAuthStore.getState();
    // Only skip if the cached profile belongs to this user
    if (userProfile?.auth_id === userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const user = await getUserByAuthId(userId);
      setUserProfile(user ?? null);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }
  ```

---

### 1.4 Hardcoded `CLUSTERS` Breaks Dynamic & Multi-Campus Clusters

- **Files:** [`src/lib/constants.ts:1`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/constants.ts#L1), [`src/app/(admin)/events/details/event-summary.tsx:42-54`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/events/details/event-summary.tsx#L42-L54>), [`src/app/(admin)/events/export-event.ts:65-75`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/events/export-event.ts#L65-L75>)
- **Problem:** `CLUSTERS` is a frozen compile-time array:
  ```ts
  export const CLUSTERS = ['Pedro Gil', 'Padre Faura', 'Taft', 'SHS', 'PGH'] as const;
  ```
  Both `event-summary.tsx` and `export-event.ts` iterate this constant to build per-cluster breakdowns, filtering reports by `r.cluster.name === cluster`. Any cluster created or renamed through the Settings UI will never appear in those views.
- **Impact:**
  - Reports from non-hardcoded clusters are silently dropped from the "By Cluster" Excel sheet.
  - The "Pending" cluster list on the event detail page is inaccurate — it will always show the five hardcoded names, never the actual active clusters.
- **Fix:** Replace the static `CLUSTERS` usage with a dynamic derivation from the actual report data or from a `getCampusClusters(campusId)` call:
  ```ts
  // In event-summary.tsx
  const clusterNames = [...new Set(reports.map((r) => r.cluster.name))].sort();

  // In export-event.ts — use the clusters from reports instead of the constant
  const clusterNames = [...new Set(reports.map((r) => r.cluster.name))].sort();
  clusterNames.forEach((cluster) => { ... });
  ```

---

### 1.5 Incorrect Active Event Count on Landing Page

- **File:** [`src/actions/landing/index.ts:21`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/landing/index.ts#L21)
- **Problem:**
  ```ts
  const activeEvents = events.filter((e) => e.status?.name?.toLowerCase() === 'ongoing').length;
  ```
  `events` is already limited to `take: 8`. If more than 8 events exist and some ongoing ones fall outside the first 8 rows (ordered by `created_at DESC`), they are not counted.
- **Impact:** The landing page stat card displays an incorrect (lower) active event count.
- **Fix:** Add a dedicated count query in the `Promise.all`:
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

---

## 2. Performance & Database Optimizations

### 2.1 Unbounded In-Memory Aggregation in `getReportClusterSummary`

- **File:** [`src/actions/reports/index.ts:171-197`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/reports/index.ts#L171-L197)
- **Problem:** Fetches every `Report` row across all campuses and all time — `prisma.report.findMany({})` with no `where` clause — to compute cluster summaries in JavaScript. As the dataset grows, this becomes a full table scan transferred entirely to Node.js memory.
- **Impact:** Linear memory growth with report volume; potential OOM crashes and multi-second response times in production.
- **Fix:** Push aggregation to Postgres using `groupBy`:
  ```ts
  const grouped = await prisma.report.groupBy({
    by: ['cluster_id'],
    _count: { id: true },
  });
  // For casualty/missing counts, use a raw subquery or a separate count per cluster.
  ```
  Or use a Postgres view/materialized view for heavy dashboard aggregations.

### 2.2 N+1 Roundtrips in `getCampusHeadcountPerEvent`

- **File:** [`src/actions/campus-table/index.ts:70-98`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/campus-table/index.ts#L70-L98)
- **Problem:** Three sequential queries:
  1. `prisma.report.findMany(...)` — gets reports
  2. `prisma.cluster.findMany({ where: { id: { in: [...clusterIds] } } })` — fetches cluster+campus info
  3. `prisma.unit.findMany({ where: { id: { in: [...unitIds] } } })` — fetches unit info
- **Impact:** 3 DB roundtrips instead of 1. Under high concurrency, this triples database connection saturation.
- **Fix:** Include relations in the initial query:
  ```ts
  const reports = await prisma.report.findMany({
    where: { event_id: eventId, cluster: { campus_id: campusId } },
    select: {
      cluster_id: true,
      unit_id: true,
      cluster: { select: { id: true, name: true, campus: { select: { id: true, name: true } } } },
      unit: { select: { id: true, name: true, cluster_id: true } },
      population_counts: {
        select: { count: true, category: { select: { id: true, name: true } } },
      },
    },
  });
  ```

### 2.3 Full Users Table Downloaded for Dashboard Stat Card

- **File:** [`src/app/(admin)/dashboard/page.tsx:49,57`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/dashboard/page.tsx#L49-L57>)
- **Problem:**
  ```ts
  const { data: users = [] } = useUsers();
  ...
  users: users.length,
  ```
  `useUsers()` calls `getUsers()` which fetches all user rows including multiple `include` relations (cluster, unit, position, user_type, campus). This entire payload is downloaded from the server just to get a `length` for a stat card number.
- **Impact:** Wasteful bandwidth and memory on both server and client. Serialized user rows with all relations can easily be 2–10 KB each; at 500 users that is 1–5 MB per dashboard load.
- **Fix:** Add a `getUserCount(campusId?: string): Promise<number>` server action that calls `prisma.user.count()`, and call that from a lightweight `useUserCount` hook.

### 2.4 Two-Query Status Lookup in `getOngoingEvents`

- **File:** [`src/actions/events/index.ts:66-84`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/events/index.ts#L66-L84)
- **Problem:** First queries `EventStatus` by name to get its `id`, then queries `Event` using that `id`. This pattern is called from `ReportForm` on every render cycle and also exists in `getMyReportForOngoingEvent` (`src/actions/reports/index.ts:210`).
- **Impact:** Every report form open costs 2 sequential DB roundtrips when Prisma can filter through the relation in a single query.
- **Fix:**
  ```ts
  return prisma.event.findMany({
    where: {
      campus_id: campusId,
      status: { name: { equals: 'Ongoing', mode: 'insensitive' } },
    },
    select: { id: true, name: true, quarter: true, started_at: true },
    orderBy: { started_at: 'desc' },
  });
  ```

### 2.5 Redundant `getCampusEvents` Sequential Queries

- **File:** [`src/actions/campus-table/index.ts:50-68`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/campus-table/index.ts#L50-L68)
- **Problem:** Makes 3 sequential queries: status lookup → completed events → non-completed events. These can be merged into a single query with client-side sort.
- **Fix:**
  ```ts
  const all = await prisma.event.findMany({
    where: { campus_id: query },
    select: { id: true, name: true, status: { select: { name: true } }, campus_id: true },
    orderBy: { started_at: 'desc' },
  });
  return all.sort((a, b) => {
    const aC = a.status?.name?.toLowerCase() === 'completed' ? 1 : 0;
    const bC = b.status?.name?.toLowerCase() === 'completed' ? 1 : 0;
    return aC - bC;
  });
  ```

---

## 3. Cache & Route Fixes

### 3.1 Wrong `revalidatePath` in Emergency Report Status Update

- **File:** [`src/actions/emergency-reports/index.ts:94`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/emergency-reports/index.ts#L94)
- **Problem:** `updateBystanderReportStatus` calls `revalidatePath('/bystander-reports')`, but the actual app route is `/emergency-reports`.
- **Impact:** After a status update, the emergency reports list page shows stale data until the user manually refreshes.
- **Fix:** Change to `revalidatePath('/emergency-reports')`.

### 3.2 `useCampus` Hook Does Not Invalidate `campuses` List Key

- **File:** [`src/components/hooks/use-settings.ts:58-63`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/hooks/use-settings.ts#L58-L63)
- **Problem:** `useCampus` queries under `['campus', campusId]`. Campus mutation hooks only invalidate `['campus']`, not `['campuses']` used by other parts of the app.
- **Fix:** On campus mutation success, invalidate both `['campus']` and `['campuses']`.

### 3.3 Case-Sensitive Badge Status Comparison

- **File:** [`src/app/(admin)/events/details/page.tsx:53-57`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/events/details/page.tsx#L53-L57>)
- **Problem:**
  ```ts
  event.status.name === 'ongoing'; // expects lowercase
  event.status.name === 'completed'; // expects lowercase
  ```
  If an admin renames a status or if the seed value has different casing, the badge will always show `warning` color.
- **Fix:** Normalize before comparison:
  ```ts
  const statusLower = event.status.name.toLowerCase();
  color={statusLower === 'ongoing' ? 'success' : statusLower === 'completed' ? 'primary' : 'warning'}
  ```

### 3.4 ERT Report Page Copy Typo

- **File:** [`src/app/(ert)/report/page.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(ert)/report/page.tsx>)
- **Problem:** The section showing an empty state renders `"No Damage reported"` instead of `"No Casualties reported"` / `"No Missing Persons reported"`.
- **Fix:** Correct the string literal to match the section context.

---

## 4. Schema Design Issues

### 4.1 Inconsistent Model Naming Convention

- **File:** [`prisma/schema.prisma`](file:///C:/Users/jomar/orca/drrmh-irs-dev/prisma/schema.prisma)
- **Problem:** Most models use PascalCase (`User`, `Cluster`, `Report`, `EventStatus`) but several use snake_case: `bystander_reports`, `bystander_incident_types`, `bystander_report_statuses`, `campus`. This inconsistency bleeds into the generated Prisma client API:
  - `prisma.bystander_reports.findMany(...)` vs `prisma.report.findMany(...)`
  - `prisma.campus.findMany(...)` vs `prisma.cluster.findMany(...)`
- **Fix:** Rename all snake_case models to PascalCase with `@@map()` to preserve underlying table names, matching the existing pattern (e.g., `@@map("reports")`).

### 4.2 `campus` Model Missing `@@map` and Audit Timestamps

- **File:** [`prisma/schema.prisma:266-274`](file:///C:/Users/jomar/orca/drrmh-irs-dev/prisma/schema.prisma#L266-L274)
- **Problem:**
  ```prisma
  model campus {
    id        String   @id ...
    name      String
    is_active Boolean  @default(true)
    // ← no created_at / updated_at
    // ← no @@map("campuses")
  }
  ```
  The `campus` model has no audit timestamps, unlike every other model. It also lacks a `@@map`, so the table is named `campus` (singular) while all other tables use plural.
- **Fix:** Add `@@map("campuses")`, `created_at DateTime @default(now())`, and `updated_at DateTime @updatedAt`; generate and apply a migration.

### 4.3 `bystander_reports` Missing Index on `cluster_id`

- **File:** [`prisma/schema.prisma:241-264`](file:///C:/Users/jomar/orca/drrmh-irs-dev/prisma/schema.prisma#L241-L264)
- **Problem:** `bystander_reports` has `@@index([incident_type_id])` and `@@index([status_id])` but **not** `@@index([cluster_id])`. Cluster-based filter queries will result in sequential scans.
- **Fix:** Add `@@index([cluster_id])` to `bystander_reports`.

### 4.4 `Report` Model Retains Legacy Flat Headcount Columns

- **File:** [`prisma/schema.prisma:92-130`](file:///C:/Users/jomar/orca/drrmh-irs-dev/prisma/schema.prisma#L92-L130)
- **Problem:** The `Report` model still has 12 hard-coded population columns (`faculty_members`, `admin_members`, `students`, etc.) alongside the newer `ReportPopulationCount` relation. New custom categories are only in `report_population_counts`, so dashboards/exports reading flat columns silently miss them.
- **Fix:** Migrate all read paths to use `report_population_counts`, then drop the flat columns in a migration (see §10).

---

## 5. Emergency Reports — Additional Bugs

### 5.1 `status_id` Can Be `undefined` on Bystander Report Create

- **File:** [`src/actions/emergency-reports/index.ts:11-21`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/emergency-reports/index.ts#L11-L21)
- **Problem:**
  ```ts
  const pendingStatus = await prisma.bystander_report_statuses.findFirst({
    where: { name: 'pending' },
  });
  // ...
  status_id: pendingStatus?.id,   // ← may be undefined if seed is missing
  ```
  If the `pending` status row has been renamed or deleted, `pendingStatus` is `null`, and Prisma skips the field, leaving `status_id` as its DB default (likely `null`). The report is created with no status and becomes invisible in filtered admin views.
- **Fix:**
  ```ts
  if (!pendingStatus)
    throw new Error('Seed data missing: "pending" bystander report status not found.');
  ```

### 5.2 `revalidatePath` Inconsistency Across Emergency Report Mutations

- **File:** [`src/actions/emergency-reports/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/emergency-reports/index.ts)
- **Problem:**
  - `createBystanderReport` — does **not** call `revalidatePath` at all
  - `updateBystanderReportStatus` — calls `revalidatePath('/bystander-reports')` (wrong path)
  - `deleteBystanderReport` — calls `revalidatePath('/emergency-reports')` (correct path)
- **Fix:** Define a shared helper:
  ```ts
  function revalidateEmergencyReports() {
    revalidatePath('/emergency-reports');
  }
  ```
  Call it consistently in all three mutations.

### 5.3 No Authorization Guard on Bystander Report Mutations

- **File:** [`src/actions/emergency-reports/index.ts:80-111`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/emergency-reports/index.ts#L80-L111)
- **Problem:** `updateBystanderReportStatus` and `deleteBystanderReport` are Server Actions with no caller authentication check. Any client can change the status of or delete any bystander report.
- **Fix:** Add a Supabase session check at the top of each mutating Server Action and verify the caller holds Administrator or Super Admin role.

---

## 6. Settings Actions — Structural Weaknesses

### 6.1 Dynamic Model Access Suppresses Type Errors

- **File:** [`src/actions/settings/index.ts:36-38`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/settings/index.ts#L36-L38)
- **Problem:** All CRUD operations use `@ts-expect-error` to suppress type-checking on dynamic model access:
  ```ts
  // @ts-expect-error dynamic model access
  return prisma[model].findMany({ orderBy: { name: 'asc' } });
  ```
  If a model name is misspelled in `MODEL_MAP` or a model is renamed in the schema, the error only surfaces at runtime.
- **Fix:** Use a discriminated switch/map or Prisma's typed delegate API to retain type safety.

### 6.2 `singularLabel` Regex Incorrectly Strips Final `s` from `campus`

- **File:** [`src/actions/settings/index.ts:41`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/settings/index.ts#L41)
- **Problem:**
  ```ts
  return TITLE_MAP[table].replace(/s$/, '').toLowerCase();
  ```
  `'Campus'` → strips trailing `s` → `'campu'`. The error message becomes: _"A campu with that value already exists."_
- **Fix:** Handle the edge case explicitly or use a proper singularization map.

### 6.3 `getSettingsItems` Returns All Records Without Pagination

- **File:** [`src/actions/settings/index.ts:34-38`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/settings/index.ts#L34-L38)
- **Problem:** Calls `findMany` with no `take` limit. The `positions` table alone has 70+ seed entries.
- **Fix:** Add server-side pagination or a search filter parameter with a reasonable max.

---

## 7. Report Form — Atomicity & Correctness

### 7.1 Multi-RPC Mutation Blast Is Not Atomic

- **File:** [`src/app/(admin)/reports/report-form.tsx:303-339`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/reports/report-form.tsx#L303-L339>)
- **Problem:** On submit, the form executes 5 sequential async phases (create/update report → delete casualties → create casualties → delete missing persons → create missing persons), each as separate Server Action RPCs. A network interruption between phases will leave the report in a partially-saved state with no rollback.
- **Impact:** Partial saves result in silently incomplete reports (e.g., zero casualties after a failed re-create).
- **Fix:** Pass `report_casualties` and `report_missing_persons` as nested arrays in a single `createReport`/`updateReport` Server Action call. The `createReport` action already supports this pattern — the form simply doesn't use it for initial creation, and update needs to be extended similarly using `{ deleteMany: {}, create: [...] }`.

### 7.2 `profileClusterId` Silently Overrides Form-Entered Cluster

- **File:** [`src/app/(admin)/reports/report-form.tsx:291`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/reports/report-form.tsx#L291>)
- **Problem:**
  ```ts
  cluster_id: profileClusterId ?? data.cluster_id,
  ```
  If the user has a cluster on their profile, it silently overrides whatever cluster they selected in the form. An ERT member temporarily covering another cluster cannot submit for it.
- **Fix:** `cluster_id: data.cluster_id` — the form value should always win. Use `profileClusterId` only for the `defaultValues` pre-fill.

### 7.3 `upsertDamageCondition` Called Inside Submit Handler Can Create Orphan Rows

- **File:** [`src/app/(admin)/reports/report-form.tsx:256-260`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/reports/report-form.tsx#L256-L260>)
- **Problem:** A custom damage condition is created by `upsertDamageCondition()` before the report is saved. If the subsequent report save fails, the newly created `DamageCondition` row remains as an unreferenced orphan.
- **Fix:** Create the damage condition inside the same server-side transaction as the report, or clean up on failure.

---

## 8. Auth Flow — Detailed Analysis

### 8.1 `ProtectedRoute` Has an Infinite-Spinner Edge Case

- **File:** [`src/components/auth/protected-route.tsx:42`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/auth/protected-route.tsx#L42)
- **Problem:**
  ```tsx
  if (loading || isRedirecting || (user && !userProfile)) {
    return <Spinner />;
  }
  ```
  If `getUserByAuthId` returns `null` (because `auth_id` was never linked — see §1.2), `userProfile` remains `null` forever. The spinner renders indefinitely with no timeout, no error message, and no way to recover.
- **Fix:** Track a `profileError` state in `AuthProvider` and surface a "Your account could not be loaded" message with a sign-out button when the fetch resolves to `null`.

### 8.2 `lastUserIdRef` Is Declared But Never Written

- **File:** [`src/components/auth/auth-provider.tsx:10`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/auth/auth-provider.tsx#L10)
- **Problem:** `const lastUserIdRef = useRef<string | null>(null)` is declared but `lastUserIdRef.current` is never assigned after a successful profile fetch. The ref was presumably introduced to deduplicate concurrent fetch calls but has no actual effect.
- **Fix:** Either implement the deduplication logic (assign `lastUserIdRef.current = userId` after a successful fetch and check before fetching), or remove the unused ref.

### 8.3 `ADMIN_USER_TYPES` Constant Is Duplicated

- **Files:** [`src/actions/users/index.ts:79`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/users/index.ts#L79), [`src/app/(ert)/report/page.tsx:67-69`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(ert)/report/page.tsx#L67-L69>)
- **Problem:** The list of admin user type names (`['Administrator', 'Super Admin']`) is defined as bare string literals in multiple files. Any role rename requires a grep across the codebase.
- **Fix:** Export `ADMIN_USER_TYPES` from [`src/lib/constants.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/constants.ts) and import it wherever needed.

---

## 9. Type Safety & Code Quality

### 9.1 `getUser(id!)` Non-Null Assertion in `useUser` Hook

- **File:** [`src/components/hooks/use-users.ts:24`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/hooks/use-users.ts#L24)
- **Problem:**
  ```ts
  queryFn: () => getUser(id!),
  enabled: !!id,
  ```
  The `enabled` guard makes this safe today, but the `!` assertion hides intent and will silently become a runtime bug if the guard is ever removed.
- **Fix:**
  ```ts
  queryFn: () => { if (!id) throw new Error('id is required'); return getUser(id); },
  ```

### 9.2 `ReportCasualty.report_id` Is Nullable Without DB Constraint

- **File:** [`prisma/schema.prisma:145`](file:///C:/Users/jomar/orca/drrmh-irs-dev/prisma/schema.prisma#L145)
- **Problem:** Both `report_id` and `bystander_report_id` are optional on `ReportCasualty`. There is no constraint enforcing that at least one is set, so orphan rows (with both FKs as `null`) can exist.
- **Fix:** Add a Postgres `CHECK` constraint:
  ```sql
  ALTER TABLE report_casualties
    ADD CONSTRAINT chk_report_casualty_has_parent
    CHECK (report_id IS NOT NULL OR bystander_report_id IS NOT NULL);
  ```
  Apply the same to `report_missing_persons`.

### 9.3 `Decimal` Latitude/Longitude Serialized Inconsistently

- **Files:** [`src/actions/reports/index.ts:12-18`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/reports/index.ts#L12-L18), [`src/actions/emergency-reports/index.ts:50-52`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/emergency-reports/index.ts#L50-L52)
- **Problem:** `reports/index.ts` uses a `serializeReport()` helper, while `emergency-reports/index.ts` spreads and manually overrides each field. Any new action returning coordinates without serialization will produce a non-JSON-serializable `Decimal` object.
- **Fix:** Centralize as a generic `serializeCoordinates<T>(obj: T): T` helper in `utils.ts`. Alternatively, change the schema to use `Float` to eliminate the `Decimal` serialization concern entirely.

### 9.4 `useCampus(campusId)` Hook Ignores Its Argument

- **File:** [`src/components/hooks/use-settings.ts:58-63`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/hooks/use-settings.ts#L58-L63)
- **Problem:**
  ```ts
  export function useCampus(campusId?: string) {
    return useQuery({
      queryKey: ['campus', campusId],
      queryFn: getCampus, // ← getCampus() ignores campusId; always returns ALL campuses
    });
  }
  ```
  Any component passing a `campusId` expecting a single campus silently gets the full list.
- **Fix:** Either fix `queryFn` to pass the argument, or rename this to `useCampuses()` and remove the misleading parameter.

### 9.5 `eventSchema` Contains a Dead `location_id` Field

- **File:** [`src/lib/schemas.ts:67`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/schemas.ts#L67)
- **Problem:**
  ```ts
  location_id: z.string().optional().nullable(),
  ```
  `Event` in `schema.prisma` has no `location_id` field. This Zod field is dead code that was never removed after a schema change and adds noise to the form type.
- **Fix:** Remove `location_id` from `eventSchema`.

---

## 10. Legacy Dual-Write Shim Risk

- **File:** [`src/lib/utils.ts:9-19`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/utils.ts#L9-L19)
- **Problem:** Every `createReport` and `updateReport` call writes population counts to both:
  1. The `report_population_counts` table (normalized, category-linked)
  2. 12 legacy flat columns on the `reports` table (via `mapPopulationCountsToLegacyColumns`)

  The shim comment says _"Delete this once those read paths are migrated onto report_population_counts"_, but there is no tracking issue, no deprecation date, and the migration of read paths is only partially done.

- **Impact:**
  - New campuses with custom `PopulationCategory` codes (not in `HEADCOUNT_FIELDS`) have their counts in `report_population_counts` only. Dashboard cards and exports that still read the flat columns show `0` for those categories — a silent data integrity issue.
  - `HEADCOUNT_FIELDS` in `constants.ts` is still exported and referenced in multiple places, creating a false impression the system is still flat-column-based.
- **Remediation plan:**
  1. Audit all read paths: identify every query/component reading the 12 flat columns.
  2. Migrate each to use `sumPopulationCountsByCategory` from `report_population_counts`.
  3. Once all reads are migrated: remove `mapPopulationCountsToLegacyColumns`, drop the flat columns from the schema, and delete `HEADCOUNT_FIELDS` from `constants.ts`.

---

## 11. Prioritized Remediation Checklist

| Priority | ID   | Area              | Description                                                                             | Execution Plan                                                                                              |
| -------- | ---- | ----------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 🔴 P0    | §1.1 | Data Integrity    | Fix `deleteUser` to nullify `events.user_id` before delete                              | [DRRM-004](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-004-events-dynamic-clusters.md)     |
| 🔴 P0    | §1.2 | Auth              | Fix `provisionGoogleUser` to update `auth_id` on email collision                        | [DRRM-001](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-001-auth-session-recovery.md)       |
| 🔴 P0    | §1.3 | Auth              | Fix `fetchProfile` stale-cache check to compare `auth_id`                               | [DRRM-001](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-001-auth-session-recovery.md)       |
| 🔴 P0    | §5.1 | Emergency Reports | Throw on missing `pending` status seed in `createBystanderReport`                       | [DRRM-002](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-002-emergency-reports-hardening.md) |
| 🟠 P1    | §1.4 | Data Correctness  | Replace hardcoded `CLUSTERS` with dynamic data in event summary and export              | [DRRM-004](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-004-events-dynamic-clusters.md)     |
| 🟠 P1    | §1.5 | Data Correctness  | Fix landing page active event count to use `prisma.event.count`                         | [DRRM-004](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-004-events-dynamic-clusters.md)     |
| 🟠 P1    | §7.1 | Data Integrity    | Make report casualty/missing-person saves atomic in a single Server Action              | [DRRM-003](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-003-report-form-atomicity.md)       |
| 🟠 P1    | §8.1 | UX                | Add `profileError` state to escape infinite spinner in `ProtectedRoute`                 | [DRRM-001](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-001-auth-session-recovery.md)       |
| 🟠 P1    | §5.3 | Security          | Add auth guard to `updateBystanderReportStatus` and `deleteBystanderReport`             | [DRRM-002](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-002-emergency-reports-hardening.md) |
| 🟡 P2    | §2.1 | Performance       | Move `getReportClusterSummary` aggregation to Postgres `groupBy`                        | [DRRM-003](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-003-report-form-atomicity.md)       |
| 🟡 P2    | §2.2 | Performance       | Collapse N+1 queries in `getCampusHeadcountPerEvent` into a single query                | [DRRM-004](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-004-events-dynamic-clusters.md)     |
| 🟡 P2    | §2.3 | Performance       | Replace `useUsers()` on dashboard with `useUserCount()`                                 | [DRRM-005](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-005-settings-hooks-performance.md)  |
| 🟡 P2    | §2.4 | Performance       | Collapse 2-query status lookup in `getOngoingEvents` (and `getMyReportForOngoingEvent`) | [DRRM-004](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-004-events-dynamic-clusters.md)     |
| 🟡 P2    | §3.1 | Cache             | Fix `revalidatePath('/bystander-reports')` → `'/emergency-reports'`                     | [DRRM-002](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-002-emergency-reports-hardening.md) |
| 🟡 P2    | §5.2 | Cache             | Add `revalidatePath` to `createBystanderReport`; make all three mutations consistent    | [DRRM-002](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-002-emergency-reports-hardening.md) |
| 🟡 P2    | §3.2 | Cache             | Invalidate `['campuses']` alongside `['campus']` on mutations                           | [DRRM-005](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-005-settings-hooks-performance.md)  |
| 🟡 P2    | §3.3 | UX                | Normalize event status name comparison to lowercase in badge                            | [DRRM-004](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-004-events-dynamic-clusters.md)     |
| 🟡 P2    | §6.1 | Type Safety       | Replace `@ts-expect-error` dynamic model access in settings actions                     | [DRRM-005](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-005-settings-hooks-performance.md)  |
| 🟡 P2    | §6.2 | Bug               | Fix `singularLabel` stripping `s` from `campus` → `campu`                               | [DRRM-005](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-005-settings-hooks-performance.md)  |
| 🟡 P2    | §7.2 | Correctness       | Remove `profileClusterId ?? data.cluster_id` override on report submit                  | [DRRM-003](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-003-report-form-atomicity.md)       |
| 🟡 P2    | §9.4 | Bug               | Fix `useCampus(campusId)` ignoring its argument                                         | [DRRM-005](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-005-settings-hooks-performance.md)  |
| 🔵 P3    | §4.1 | Schema            | Normalize model naming to PascalCase across schema                                      | [DRRM-006](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-006-schema-dual-write-sunset.md)    |
| 🔵 P3    | §4.2 | Schema            | Add `@@map`, `created_at`, `updated_at` to `campus` model                               | [DRRM-006](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-006-schema-dual-write-sunset.md)    |
| 🔵 P3    | §4.3 | Schema            | Add `@@index([cluster_id])` to `bystander_reports`                                      | [DRRM-006](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-006-schema-dual-write-sunset.md)    |
| 🔵 P3    | §6.3 | Performance       | Add pagination to `getSettingsItems`                                                    | [DRRM-005](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-005-settings-hooks-performance.md)  |
| 🔵 P3    | §8.3 | Maintainability   | Centralize `ADMIN_USER_TYPES` in `constants.ts`                                         | [DRRM-001](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-001-auth-session-recovery.md)       |
| 🔵 P3    | §9.2 | Data Integrity    | Add DB check constraint on `ReportCasualty` and `ReportMissingPerson` parent FKs        | [DRRM-006](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-006-schema-dual-write-sunset.md)    |
| 🔵 P3    | §9.3 | Code Quality      | Centralize Decimal→Number serialization for lat/lng                                     | [DRRM-002](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-002-emergency-reports-hardening.md) |
| 🔵 P3    | §9.5 | Code Quality      | Remove dead `location_id` field from `eventSchema`                                      | [DRRM-004](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-004-events-dynamic-clusters.md)     |
| 🔵 P3    | §8.2 | Code Quality      | Remove or implement `lastUserIdRef` in `AuthProvider`                                   | [DRRM-001](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-001-auth-session-recovery.md)       |
| 🔵 P3    | §10  | Tech Debt         | Audit & complete migration away from legacy flat headcount columns                      | [DRRM-006](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-006-schema-dual-write-sunset.md)    |

---

## 12. Execution Roadmap & Distribution

| Wave       | Track       | Plan Document                                                                                                 | Target Branch                       | Focus Areas                                                                            |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| **Wave 1** | **Track A** | [`DRRM-001`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-001-auth-session-recovery.md)       | `fix/auth-session-recovery`         | OAuth email linking, auth store stale cache, protected route error boundary            |
| **Wave 1** | **Track B** | [`DRRM-002`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-002-emergency-reports-hardening.md) | `fix/emergency-reports-hardening`   | Emergency report seed checks, auth guards, cache path fixes, coordinate serializer     |
| **Wave 2** | **Track C** | [`DRRM-003`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-003-report-form-atomicity.md)       | `fix/report-form-atomicity`         | Report form atomic submit transaction, cluster override fix, Postgres aggregation      |
| **Wave 2** | **Track D** | [`DRRM-004`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-004-events-dynamic-clusters.md)     | `fix/events-dynamic-clusters`       | User deletion FK nullification, dynamic clusters, landing page stats, N+1 queries      |
| **Wave 2** | **Track E** | [`DRRM-005`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-005-settings-hooks-performance.md)  | `fix/settings-hooks-performance`    | Dashboard count query, settings type delegation, 'campu' regex bug, cache invalidation |
| **Wave 3** | **Track F** | [`DRRM-006`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/fix/DRRM-006-schema-dual-write-sunset.md)    | `refactor/schema-dual-write-sunset` | PascalCase schema models, @@map, timestamps, check constraints, dual-write sunset      |
