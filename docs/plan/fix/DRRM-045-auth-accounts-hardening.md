---
type: fix
ticket: DRRM-045
status: done
branch: fix/DRRM-045-auth-accounts-hardening
modules:
  - '[[auth]]'
  - '[[users]]'
tags: [plan, fix, security]
---

# [DRRM-045] Fix Plan: Sign-in and account hardening

- **Status:** `[Done]`
- **Related Bugs / Audits:** GitHub #100, #101 (user actions), #86, #110; closes the leftovers of #85
- **Target Branch / PR:** `fix/DRRM-045-auth-accounts-hardening`
- **Author:** Bryan Mangapit

---

## 1. Objective & Scope

The sign-in and account actions still trusted values the browser sends:

- `provisionGoogleUser(authId, email, fullName)` took the identity as arguments. Anyone could
  re-bind an existing admin profile to their own (or a random) `auth_id`, or get an ERT profile
  for a made-up `@up.edu.ph` email from a personal Google account (#100).
- `completeUserProfile`, `createUser` and `updateUser` spread the payload into Prisma, so extra
  keys reached the database: an ERT member could send `user_type_id` and become Super Admin, and
  an Administrator could move themselves to another campus (#101).
- Profile setup and Add / Edit user never checked that the cluster is on the campus and the unit
  in the cluster before adding a typed unit (#86).
- `?from=` on `/signin` let `/<tab>/evil.example` through, which the browser turns into
  `//evil.example` (#110).

#85 (caller checks on the user actions) was already fixed by DRRM-026; this plan finishes the
optional parts (an admin can't turn off or delete their own account; refusals come back as
`ok: false` so production shows them).

Non-goals: the report, event, settings and other action modules (DRRM-046, DRRM-047).

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [x] `src/actions/auth/index.ts`: `provisionGoogleUser(token)` verifies the token with
      `supabaseAdmin.auth.getUser` and takes the auth id, email and name from that user only
      (`googleIdentity` in `src/lib/google-provision.ts`): Google provider, confirmed email, on
      `@up.edu.ph`. A profile with the same email is linked only when the sign-in it points at no
      longer exists in Supabase Auth (both the first lookup and the `P2002` fallback); otherwise
      `taken`. Returns `{ ok: true, userTypeName } | { ok: false, reason }` instead of throwing.
- [x] `src/actions/users/index.ts`:
  - `completeUserProfile(token, data)` parses `completeProfileSchema` (strict: campus, cluster,
    unit, position and the typed names). Refused for a finished profile, an admin, or an
    off-campus account. The campus must exist and be active.
  - `createUser` / `updateUser` parse `userCreateInputSchema` / `userUpdateInputSchema` (strict
    allowlists of profile columns; never `auth_id`, `is_profile_complete` or relations).
  - `withNamedAssignment` runs `checkAssignment` first: the cluster must be on the campus and the
    unit in the cluster, before a typed unit or position is added. An edit that leaves the campus
    or cluster out is checked against the saved one.
  - `createUser`, `updateUser`, `setUserActive` return `{ ok: true, user } | { ok: false, error }`.
  - `setUserActive(…, false)` and `deleteUser` refuse the caller's own account; ids are checked
    with `isUuid` before they reach a `where`.
- [x] `src/lib/utils.ts`: `isUuid(value)`.

### 2.2 Frontend / Components

- [x] `src/app/auth/callback/page.tsx`: sends `session.access_token` only, and maps the
      `reason` to `/signin?error=domain|taken|setup|timeout`.
- [x] `src/app/(auth)/signin/sign-in-form.tsx`: a `taken` banner.
- [x] `src/lib/access.ts`: `signInDestination` resolves `from` with `new URL` against a stand-in
      origin, refuses control characters and backslashes, keeps only a same-origin path (rebuilt
      from pathname, search and hash).
- [x] `src/components/hooks/use-users.ts`: create, update and the Active switch throw the
      server's `error` in the browser, so the existing toasts show it.

### 2.3 Database / Prisma

- None.

---

## 3. Verification

- [x] `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`
- [x] Tests: `google-provision.test.ts` (domain, provider, confirmed email, name and username),
      `access.test.ts` (tab, LF, CR, NUL in `from`; query and hash kept), `schemas.test.ts`
      (profile setup and user allowlists refuse `user_type_id`, `auth_id`, `is_active`, relations).
- [ ] Manual: Google sign-in for a new `@up.edu.ph` member, a returning member, and an admin-made
      account; profile setup with picked and typed cluster / unit / position; Users page add,
      edit, Active switch with Undo, delete.

## 4. After deploying

Check Supabase Auth users and the `users` table for accounts nobody on the team created, and for
profiles whose `auth_id` changed recently (the takeover in #100 re-binds `auth_id`).
