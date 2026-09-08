# Code Review & Audit Findings — `dev` Branch

- **Date:** 2026-09-08
- **Branch:** `dev`
- **Scope:** Architecture, correctness, security, database performance, state synchronization, and code quality.
- **Status:** `[Approved for Action Planning]`

---

## 1. Critical & High-Risk Bugs

### 1.1 Foreign Key Constraint Violation on User Deletion

- **Files:** `src/actions/users/index.ts:182-200`
- **Problem:** `deleteUser(id)` nullifies `report.user_id` but neglects `event.user_id`. `Event` has `user_id` referencing `User` with `onDelete: NoAction`.
- **Impact:** Deleting any user who created an event fails with a Postgres foreign key violation (`P2003`).
- **Fix:** Nullify `events.user_id` before deleting:
  ```ts
  await prisma.event.updateMany({ where: { user_id: id }, data: { user_id: null } });
  await prisma.report.updateMany({ where: { user_id: id }, data: { user_id: null } });
  await prisma.user.delete({ where: { id } });
  ```

---

### 1.2 Google OAuth User Linking Failure on Existing Accounts

- **Files:** `src/actions/auth/index.ts:54-67`
- **Problem:** In `provisionGoogleUser()`, when an existing email is detected (catching `P2002`), it returns the role but does **not update `byEmail.auth_id` to the new Google `authId`**.
- **Impact:** Subsequent `getUserByAuthId(userId)` returns `null` because `auth_id` was never linked.
- **Fix:** Update `auth_id` when the existing account by email is detected:
  ```ts
  if (byEmail) {
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { auth_id: authId },
    });
    return { userTypeName: byEmail.user_type.name };
  }
  ```

---

### 1.3 Stale LocalStorage Auth Profile & Account Switching Bug

- **Files:** `src/store/auth.store.ts:57-61`, `src/components/auth/auth-provider.tsx:40-56`
- **Problem:** `useAuthStore` persists `userProfile` to `localStorage` under `irs-auth`. `AuthProvider.fetchProfile(userId)` exits early whenever `userProfile !== null`.
- **Impact:**
  1. Role/permission/cluster updates made by admins are never synced until local storage is manually cleared.
  2. Switching accounts on the same browser can retain the previous user's profile if `userProfile.auth_id !== userId`.
- **Fix:** Verify `userProfile.auth_id === userId` and background-revalidate the profile.

---

### 1.4 Hardcoded `CLUSTERS` Breaks Dynamic & Multi-Campus Clusters

- **Files:** `src/app/(admin)/events/details/event-summary.tsx:42-55`, `src/app/(admin)/events/export-event.ts:65-75`
- **Problem:** Iterates over hardcoded `CLUSTERS = ['Pedro Gil', 'Padre Faura', 'Taft', 'SHS', 'PGH']`.
- **Impact:** Custom clusters created in settings or other regional campuses are excluded from summaries and Excel exports.
- **Fix:** Dynamically extract cluster names from report data or query campus clusters.

---

### 1.5 Incorrect Active Event Count on Landing Page

- **Files:** `src/actions/landing/index.ts:16-23`
- **Problem:** `activeEvents` filters only the `take: 8` slice of recent events.
- **Impact:** Active drills outside the top 8 newest rows are not counted.
- **Fix:** Run `prisma.event.count({ where: { status: { name: { equals: 'ongoing', mode: 'insensitive' } } } })` in `Promise.all`.

---

## 2. Performance & Database Optimizations

1. **Unbounded In-Memory Aggregation in `getReportClusterSummary` (`src/actions/reports/index.ts`):**
   - Use `prisma.report.groupBy` with `campus_id` filter instead of pulling all rows into Node.js memory.
2. **N+1 Roundtrips in `getCampusHeadcountPerEvent` (`src/actions/campus-table/index.ts`):**
   - Include `cluster.campus` and `unit` directly in the single `prisma.report.findMany` call to eliminate 2 queries.
3. **Dashboard Downloading Full Users Table (`src/app/(admin)/dashboard/page.tsx`):**
   - Add `getUserCount(campusId?: string)` using `prisma.user.count()` instead of loading the entire table.
4. **Eliminate Redundant Status Query in `getOngoingEvents` (`src/actions/events/index.ts`):**
   - Query directly via relation filter `where: { campus_id: campusId, status: { name: { equals: 'ongoing', mode: 'insensitive' } } }`.
5. **Multi-RPC Mutation Blast on Report Submission (`src/app/(admin)/reports/report-form.tsx`):**
   - Pass nested `report_casualties` and `report_missing_persons` in a single atomic Server Action call.

---

## 3. Cache & Route Fixes

1. `src/actions/emergency-reports/index.ts`: Fix `revalidatePath('/bystander-reports')` → `revalidatePath('/emergency-reports')`.
2. `src/components/hooks/use-settings.ts`: Invalidate `['campuses']` alongside `['campus']`.
3. `src/app/(ert)/report/page.tsx`: Fix typo `"No Damage reported"` → `"No Casualties reported"`.
4. `src/app/(admin)/events/details/page.tsx`: Fix case sensitivity in badge status comparison.
