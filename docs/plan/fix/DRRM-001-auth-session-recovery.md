# [DRRM-001] Fix Plan: Auth Flow & Session Recovery Hardening

- **Status:** `[Done]`
- **Related Bugs / Audits:** [`docs/plan/review/2026-09-08-dev-branch-audit.md`](file:///C:/Users/jomar/orca/drrmh-irs-dev/docs/plan/review/2026-09-08-dev-branch-audit.md) (§1.2, §1.3, §8.1, §8.2, §8.3)
- **Target Branch / PR:** `fix/auth-session-recovery`
- **Author:** Antigravity

---

## 1. Objective & Scope

Resolve critical authentication and session synchronization defects that cause users to be trapped in permanent loading states, prevent pre-existing accounts from signing in with Google OAuth, and prevent permission updates or account switching from reflecting properly due to stale localStorage cache.

### Non-Goals

- Migrating to `@supabase/ssr` cookies (this is a larger architectural change scheduled for a future release; client PKCE flow in localStorage is preserved).
- Refactoring user profile editing forms.

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [x] [`src/actions/auth/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/auth/index.ts):
  - In `provisionGoogleUser`, when a `P2002` unique email violation occurs on `prisma.user.create`, find the existing user by email and update their `auth_id` to the current `authId`:
    ```ts
    if (byEmail) {
      const updated = await prisma.user.update({
        where: { id: byEmail.id },
        data: { auth_id: authId },
        include: { user_type: true },
      });
      return { userTypeName: updated.user_type.name };
    }
    ```
  - This ensures that subsequent calls to `getUserByAuthId(authId)` succeed rather than returning `null`.

- [x] [`src/actions/users/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/users/index.ts):
  - Replace local `const ADMIN_USER_TYPES = ['Administrator', 'Super Admin']` with an import from [`src/lib/constants.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/constants.ts).

### 2.2 Shared Constants & Library

- [x] [`src/lib/constants.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/constants.ts):
  - Export `ADMIN_USER_TYPES = ['Administrator', 'Super Admin'] as const;`, `type AdminUserType = (typeof ADMIN_USER_TYPES)[number];`, and `isAdminUserType(type?: string | null): type is AdminUserType`.

### 2.3 Client State & Auth Components

- [x] [`src/store/auth.store.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/store/auth.store.ts):
  - Add `profileError: string | null` to `AuthState` (default `null`).
  - Provide `setProfileError: (error: string | null) => void`.
  - In `reset()`, reset `profileError: null`.

- [x] [`src/components/auth/auth-provider.tsx`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/auth/auth-provider.tsx):
  - In `fetchProfile(userId: string)`:
    - Compare `userProfile.auth_id === userId` before deciding to use the cached profile. If `userProfile` is present but belongs to a different `auth_id` (or is missing `auth_id`), invalidate and re-fetch.
    - Implement `lastUserIdRef.current = userId` deduplication to prevent duplicate concurrent queries during auth events.
    - If `getUserByAuthId(userId)` returns `null` or throws, set `setProfileError('Your user account could not be found. Please contact an administrator.')` and `setLoading(false)`.
    - Clear `profileError` upon successful fetch or sign-out.

- [x] [`src/components/auth/protected-route.tsx`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/auth/protected-route.tsx):
  - Read `profileError` from `useAuthStore`.
  - If `profileError` is non-null, display a clean error card with an explicit "Sign Out" button calling `supabase.auth.signOut()` instead of rendering an endless spinner.

- [x] [`src/app/(ert)/report/page.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(ert)/report/page.tsx>):
  - Replace inline `['Administrator', 'Super Admin']` check with `isAdminUserType(type)` imported from [`@/lib`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/constants.ts).

---

## 3. Step-by-Step Execution Plan

1. [x] **Step 1:** Export `ADMIN_USER_TYPES` & `isAdminUserType` in [`src/lib/constants.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/lib/constants.ts) and reference it in [`src/actions/users/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/users/index.ts) and [`src/app/(ert)/report/page.tsx`](<file:///C:/Users/jomar/orca/drrmh-irs-dev/src/app/(ert)/report/page.tsx>).
2. [x] **Step 2:** Update `provisionGoogleUser` in [`src/actions/auth/index.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/actions/auth/index.ts) to update `auth_id` on the matching email record.
3. [x] **Step 3:** Extend [`src/store/auth.store.ts`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/store/auth.store.ts) with `profileError` state and setter.
4. [x] **Step 4:** Refactor `fetchProfile` in [`src/components/auth/auth-provider.tsx`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/auth/auth-provider.tsx) to validate `auth_id` equality and handle profile-not-found errors.
5. [x] **Step 5:** Update [`src/components/auth/protected-route.tsx`](file:///C:/Users/jomar/orca/drrmh-irs-dev/src/components/auth/protected-route.tsx) to render a recovery/error state when `profileError` is present.

---

## 4. Testing & Verification

- [x] Lint check: `npm run lint` (0 errors)
- [x] Type check: `npm run type-check` (0 errors)
- [x] Build check: `npm run build` (All 23 static pages compiled & generated successfully)
- [ ] Manual test scenarios:
  1. **Google OAuth account collision:** Sign in with Google using an email that already exists as a password-created account. Verify user lands on dashboard/report without getting stuck.
  2. **Account switching:** Sign in as User A, sign out, then sign in as User B on the same browser. Verify User B does not see User A's cached profile.
  3. **Deleted or unlinked profile:** Emulate a Supabase user with no corresponding DB row. Verify the user is shown the error card with a working "Sign Out" button rather than an infinite spinner.
