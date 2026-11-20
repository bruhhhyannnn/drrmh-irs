---
type: module
module: auth
updated: 2026-11-20
verified: true
paths:
  - src/actions/auth
  - src/components/auth
  - src/app/(auth)
  - src/app/auth/callback
  - src/lib/server-auth.ts
  - src/lib/access.ts
  - src/lib/constants.ts
  - src/store/auth.store.ts
tags: [module]
---

# Auth and profiles

Sign-in, the signed-in user's profile, and the role checks that decide where a user lands. Supabase Auth is the identity provider; the `users` table holds the app profile, linked by `auth_id`. ERT members sign in with Google (`@up.edu.ph`) and must finish a profile setup before using the app. Administrators and Super Admins usually sign in with email and password, on accounts made in [[users]].

**Related:** [[architecture]] · [[users]] · [[campus-scoping]] · [[database]] · [[assessments]] · [[design-system]] · [[routes]]

## Essentials

Read this before touching sign-in, the profile, role checks or the setup gate.

- **Identity:** Supabase Auth is the identity provider. Google OAuth is restricted to `@up.edu.ph` emails: the button passes `hd: 'up.edu.ph'` (only a hint to Google's picker), and `provisionGoogleUser` refuses anything but a confirmed `@up.edu.ph` Google identity, read from the verified token (DRRM-045). Email + password sign-in also exists (`signInWithPassword` in `src/app/(auth)/signin/sign-in-form.tsx`).
- **Profile:** the `users` table (Prisma) holds the app profile, linked to the Supabase user by `auth_id`.
- **Loading the profile:** `AuthProvider` (`src/components/auth/auth-provider.tsx`) listens to `supabase.auth.onAuthStateChange`, then loads the profile through the `getMyProfile(token)` server action, which finds it from the verified token, into `useAuthStore` (Zustand).
- **First Google sign-in:** `provisionGoogleUser(token)` (`src/actions/auth`) adds the user to `users` with the "ERT Member" user type. Who they are comes only from the verified token (#100).
- **Roles:** `ProtectedRoute` gates admin pages by role. Admin vs. non-admin is decided by `isAdminUserType()` (`src/lib/constants.ts`). "Administrator" and "Super Admin" land on `/dashboard`, everyone else on `/home` ([[routes]]).
- **Off-campus accounts (DRRM-026):** a Super Admin makes them on the Users page with an email and password; Google stays `@up.edu.ph` only. `users.is_off_campus` accounts have no campus, cluster, unit or position (`chk_users_off_campus`). `ProfileSetup` shows `OffCampusSetup` for them, in three steps with Back and Next (About you; Your home address; Where you work, with the data privacy consent). Addresses are picked from the PSGC lists, as in the assessment (`LocationFields` in `src/components/common`), and saved as one readable line (`composeAddress`, `src/lib/off-campus-setup.ts`), saved by the token-verified `completeOffCampusProfile`. `canUseReport` (`src/lib/access.ts`) is false for them.
- **Profile setup:** non-admin profiles start with `is_profile_complete = false`. `ProfileSetupGate` / `ProfileSetup` (`src/components/auth/profile-setup.tsx`) show a full-page setup in place of the app until the user sets campus, cluster, position and (optionally) unit through `completeUserProfile` (`src/actions/users`). New field reports then auto-fill cluster and unit from that profile ([[field-reports]]).
- **Shared frame:** the auth pages (`(auth)/`) and profile setup share the `AuthShell` frame and the design-system controls in `src/components/ds/` ([[design-system]]).
- **Token checks:** newer server actions don't trust a client-sent user id. They take the Supabase access token (`getAccessToken()` in `src/lib/supabase.ts`) and verify it with `requireProfile(token)` or `requireAdmin(token, campusId)` from `src/lib/server-auth.ts` ([[0007-token-verified-actions]]).

## Where it lives

| Path                                                                             | What it holds                                                                     |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/actions/auth/index.ts`                                                      | `provisionGoogleUser`, run after a Google sign-in                                 |
| `src/app/(auth)/signin/`                                                         | `/signin`: Google button first, then email and password (`sign-in-form.tsx`)      |
| `src/app/(auth)/forgot-password/`, `update-password/`                            | Password reset by email, then set a new password                                  |
| `src/app/auth/callback/page.tsx`                                                 | OAuth callback, a client page (not a route handler)                               |
| `src/components/auth/auth-provider.tsx`                                          | Listens to Supabase auth, loads the profile into the store                        |
| `src/components/auth/protected-route.tsx`                                        | `ProtectedRoute`, guard for `(admin)`, `(pillars)`, `(print)` layouts             |
| `src/components/auth/account-load-failed.tsx`                                    | `AccountLoadFailed`: Retry and Sign Out when the profile can't be loaded          |
| `src/components/auth/profile-setup.tsx`                                          | `ProfileSetupGate` and the full-page `ProfileSetup`                               |
| `src/components/auth/profile-drawer.tsx`                                         | `ProfileDrawer` ("My profile"): details, appearance, checklist language, Sign out |
| `src/components/auth/auth-shell.tsx`, `auth-ui.tsx`, `google-sign-in-button.tsx` | The auth page frame, banners and headings, Google button                          |
| `src/lib/server-auth.ts`                                                         | `requireProfile(token)`, `requireAdmin(token, campusId)` (server only)            |
| `src/lib/access.ts`                                                              | `canUseAssessment`, `homePathFor`, `signInDestination`, `adminGuard`, `ertGuard`  |
| `src/lib/constants.ts`                                                           | `USER_TYPES`, `isAdminUserType()`                                                 |
| `src/store/auth.store.ts`                                                        | `useAuthStore` (Zustand, persisted)                                               |
| `src/app/(ert)/_lib/use-ert-access.ts`                                           | `useErtAccess`, the guard for ERT pages                                           |

## Data

- `User` (`users`): `auth_id` (unique, Supabase Auth id), `email` and `username` (unique), `user_type_id`, `campus_id`, `cluster_id`, `unit_id`, `position_id`, `is_active`, `is_profile_complete` (default `false`).
- `UserType` (`user_types`): seeded names are `ERT Member`, `Administrator`, `Super Admin` (`USER_TYPES`).
- `Cluster` (`clusters`), `Position` (`positions`), `Unit` (`units`): `completeUserProfile` reuses or adds one by name for "Other (please specify)" (`clusterIdForName`, `positionIdForName`, `unitIdForName` in `src/lib/lookup-names.ts`). Cluster names are unique across campuses, so a name another campus has is refused (DRRM-020).

## Server actions

`src/actions/auth/index.ts`:

- `provisionGoogleUser(token)`: verifies the token with `supabaseAdmin.auth.getUser` and takes the auth id, email and name from that user only (`googleIdentity` in `src/lib/google-provision.ts`: Google provider, confirmed email, `@up.edu.ph`). Returns the existing profile by `auth_id`; else links a profile with the same email, but only when the sign-in it points at no longer exists in Supabase Auth (else `taken`, so nobody can re-bind an existing account); else creates an `ERT Member` with `username` = email local part + first 6 hex of the auth id. A `P2002` race falls back to the same linking rule. Returns `{ ok: true, userTypeName } | { ok: false, reason: 'signed_out' | 'domain' | 'taken' | 'setup' }`, never throws.

Profile actions used by this module live in `src/actions/users` (see [[users]]): `getMyProfile(token)` (which also refreshes the Google profile photo from the verified session, DRRM-039) and `completeUserProfile(token, data)`. Both work only on the account behind the verified token (since the DRRM-025/026 security review).

Token-verified helpers in `src/lib/server-auth.ts` (used by assessment, checklist and building-safety actions):

- `requireProfile(token)`: verifies the token with `supabaseAdmin.auth.getUser`, loads the profile with user type, position, campus, cluster, unit. Returns `{ ok: false, reason }` with `signed_out`, `no_profile` or `inactive` (plus `profileId`). Results are cached per token for 15 s (at most about 100 entries); failures are not cached.
- `requireAdmin(token, requestedCampusId?)`: `requireProfile` then `adminScope` (see [[campus-scoping]]).

## Client side

- Routes: `/signin` (reads `?from=` and `?error=domain|taken|setup|timeout`), `/forgot-password`, `/update-password`, `/auth/callback`.
- Google: `GoogleSignInButton` calls `signInWithOAuth` with `hd: 'up.edu.ph'`, `prompt: 'select_account'`, redirect to `${NEXT_PUBLIC_SITE_URL ?? origin}/auth/callback`.
- Callback: waits for the session (`getSession` plus `SIGNED_IN`), calls `provisionGoogleUser(session.access_token)`, then goes to `homePathFor(userTypeName)`; an `ok: false` signs out and goes to `/signin?error=<reason>`. A 20 s timeout, which covers provisioning too → `/signin?error=timeout`; a session that did land is then picked up by `SignInForm`.
- `SignInForm`: once signed in it shows "Signing you in…", waits for the profile and replaces to `signInDestination(type, from)`: non-admins always `/home`, admins `?from=` when it resolves to a path on this origin (with `new URL`, so a tab or newline can't turn `/` into `//other.site`, #110), else `/dashboard`. If the profile fails it goes to `/home`, which shows `AccountLoadFailed`.
- `AuthProvider` (mounted in `src/components/providers.tsx`): `getSession` then `onAuthStateChange` (ignores `PASSWORD_RECOVERY`), and loads the profile with `getMyProfile(await getAccessToken())` into `useAuthStore`. One fetch per user at a time, an answer for a superseded user is ignored, and after 20 s it sets `profileError` (a fixed message, because production hides thrown ones).
- `useAuthStore`: `user`, `session`, `userProfile`, `profileError`, `loading`, `reset()`. Persisted in localStorage as `irs-auth`, only `userProfile`.
- `ProtectedRoute`: `adminGuard` decides during render, and only `allow` mounts the children. No user → `/signin?from=<path>`; any non-admin → `/home`; `profileError` shows `AccountLoadFailed`.
- `ProfileSetupGate` wraps the `(admin)` layout; ERT pages get `{ status: 'setup' }` from `useErtAccess` and render `ProfileSetup`. `useErtAccess` (`ertGuard`) sends signed-out users to `/signin`, admins to `/dashboard`, and (with `requireAssessment`) users failing `canUseAssessment` to `/home`. `{ status: 'error' }` means the profile failed to load, and the page shows `AccountLoadFailed`.
- `completeUserProfile` works once, for a campus account whose profile isn't complete; admins and off-campus accounts are refused (DRRM-045).
- `ProfileSetup` asks for campus, cluster (or Other (please specify), which opens Specify cluster), building / unit (optional, since some clusters have none: No unit first, Other (please specify) last, which opens Specify unit; a typed cluster lists only those two) and position (or a custom one), then calls `completeUserProfile`. It stores the returned profile, or shows the `ok: false` message (a typed cluster name another campus has) in the page banner.

## Rules and gotchas

- Admin vs non-admin is decided by `isAdminUserType()` only ("Administrator", "Super Admin"). Landing pages come from `homePathFor`.
- A guard must decide during render, not in an effect: a child's effects run before its parent's, so children returned for even one render start their queries.
- Assessment access is decided only by `canUseAssessment()` (today: user type is `ERT Member`). The `/home` card, the top-bar switch, the page guard and `checkAssessmentCaller` all call it.
- `AuthProvider` reuses a persisted `userProfile` when its `auth_id` matches the session user and skips the fetch. Changes an admin makes to that user (type, campus, active) show only after sign-out (`reset()`) or cleared storage.
- `is_active = false` is not checked by `ProtectedRoute`, `useErtAccess` or the sign-in pages. Only `requireProfile` refuses inactive users, so only token-verified actions block them.
- Everything in `src/actions/users` now checks its caller (DRRM-025/026 security review). New actions should take `getAccessToken()` and call `requireProfile` / `requireAdmin`.
- The callback must stay a client page: supabase-js keeps the PKCE verifier in localStorage, which a route handler cannot read.
- Accounts made by an admin in [[users]] start with `is_profile_complete = true` only for admin user types; ERT members still see `ProfileSetup`.
- Google users who already have an admin-made account with the same email are linked, not duplicated.

## Decisions

- [[0001-server-actions-only]] profile reads and provisioning are server actions over Prisma.
- [[0007-token-verified-actions]] `requireProfile` / `requireAdmin` live here and are the pattern for new actions.
