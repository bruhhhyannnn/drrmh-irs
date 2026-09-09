# [DRRM-005] Fix Plan: Settings Actions, Query Hooks & Dashboard Performance

- **Status:** `[Approved]`
- **Related Bugs / Audits:** [`docs/plan/review/2026-09-08-dev-branch-audit.md`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/review/2026-09-08-dev-branch-audit.md) (§2.3, §3.2, §6.1, §6.2, §6.3, §9.1, §9.4)
- **Target Branch / PR:** `fix/settings-hooks-performance`
- **Author:** Antigravity

---

## 1. Objective & Scope

Optimize dashboard performance by replacing massive full-table user downloads with a lightweight count query, fix string manipulation bugs in settings error handling, resolve type safety gaps in dynamic settings actions, fix query cache invalidation omissions, and address query hook argument omissions.

### Non-Goals

- Redesigning the settings management tables or modal forms.
- Re-architecting settings permissions.

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [ ] [`src/actions/users/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/users/index.ts):
  - Add lightweight count action (§2.3):
    ```ts
    export async function getUserCount(campusId?: string): Promise<number> {
      return prisma.user.count({
        where: campusId ? { campus_id: campusId } : undefined,
      });
    }
    ```

- [ ] [`src/actions/settings/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/settings/index.ts):
  - **Type-Safe Model Delegation (§6.1):** Replace `@ts-expect-error` dynamic indexing with a strongly-typed delegate mapping:
    ```ts
    const DELEGATE_MAP = {
      clusters: prisma.cluster,
      units: prisma.unit,
      positions: prisma.position,
      casualty_conditions: prisma.casualtyCondition,
      damage_conditions: prisma.damageCondition,
      campus: prisma.campus,
    } as const;
    ```
  - **Fix Singularization Regex (§6.2):** Prevent `'Campus'` from becoming `'campu'`:
    ```ts
    function singularLabel(table: SettingsTable) {
      const labelMap: Record<SettingsTable, string> = {
        clusters: 'cluster',
        units: 'unit',
        positions: 'position',
        casualty_conditions: 'casualty condition',
        damage_conditions: 'damage condition',
        campus: 'campus',
      };
      return labelMap[table] ?? TITLE_MAP[table].toLowerCase();
    }
    ```
  - **Pagination / Search Support (§6.3):** Support optional search and limit in `getSettingsItems(table, { query, limit, page })`.

### 2.2 Client Hooks & Dashboard

- [ ] [`src/components/hooks/use-users.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/hooks/use-users.ts):
  - Add `useUserCount(campusId?: string)` hook invoking `getUserCount(campusId)`.
  - In `useUser(id?: string)`, replace `id!` with an explicit guard to eliminate unsafe non-null assertion (§9.1):
    ```ts
    queryFn: () => {
      if (!id) throw new Error('User ID is required');
      return getUser(id);
    },
    ```

- [ ] [`src/app/(admin)/dashboard/page.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/dashboard/page.tsx>):
  - Replace `const { data: users = [] } = useUsers()` with `const { data: userCount = 0 } = useUserCount(campusId)` (§2.3). Eliminates downloading full user rows and relations solely for the count card.

- [ ] [`src/components/hooks/use-settings.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/hooks/use-settings.ts):
  - **Fix `useCampus` Hook (§9.4):** Provide `useCampuses()` for the full list and `useCampus(campusId)` calling `getCampusById(campusId)` when an ID is supplied.
  - **Multi-Key Invalidation (§3.2):** Ensure campus mutations invalidate both `['campus']` and `['campuses']`.

---

## 3. Step-by-Step Execution Plan

1. [ ] **Step 1:** Implement `getUserCount` in [`src/actions/users/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/users/index.ts) and `useUserCount` in [`src/components/hooks/use-users.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/hooks/use-users.ts).
2. [ ] **Step 2:** Refactor [`src/app/(admin)/dashboard/page.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(admin)/dashboard/page.tsx>) to consume `useUserCount`.
3. [ ] **Step 3:** Fix `singularLabel` and remove `@ts-expect-error` in [`src/actions/settings/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/settings/index.ts).
4. [ ] **Step 4:** Fix `useCampus` parameter handling and query invalidation in [`src/components/hooks/use-settings.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/hooks/use-settings.ts).
5. [ ] **Step 5:** Fix non-null assertion in `useUser` hook.

---

## 4. Testing & Verification

- [ ] Lint check: `npm run lint`
- [ ] Type check: `npm run type-check`
- [ ] Build check: `npm run build`
- [ ] Manual test scenarios:
  1. **Dashboard Load Network Inspection:** Open admin dashboard with DevTools Network tab. Verify payload size for user metrics drops from megabytes to a minimal integer response.
  2. **Campus Duplicate Error Message:** Attempt to create a duplicate campus in Settings. Verify error says "A campus with that value already exists" (not "campu").
  3. **Campus Cache Invalidation:** Add or edit a campus; verify lists throughout the app immediately refresh without manual reload.
