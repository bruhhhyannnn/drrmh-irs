---
type: fix
ticket: DRRM-049
status: done
branch: fix/DRRM-049-hardening
modules:
  - '[[auth]]'
  - '[[users]]'
  - '[[bystander-reports]]'
  - '[[offline-pwa]]'
  - '[[database]]'
tags: [plan, fix, security]
---

# [DRRM-049] Fix Plan: Hardening: inactive accounts, rate limit, headers, dependencies

- **Status:** `[Done]`
- **Related Bugs / Audits:** GitHub #104
- **Target Branch / PR:** `fix/DRRM-049-hardening`
- **Author:** Bryan Mangapit

---

## 1. Objective & Scope

The defence-in-depth items from the 2026-11-10 audit (#104):

1. A turned-off account kept using the app from the profile saved in the browser, and the
   guards never looked at `is_active`.
2. The public `createBystanderReport` (8 MB bodies, Storage uploads) had no rate limit.
3. No HTTP security headers.
4. `npm audit`: 27 findings (9 high), including Next.js 16.4.3 itself.
5. `requireProfile`'s cache could grow past 100 entries under a burst of distinct tokens.

Non-goals: enforcing the CSP (report-only first), a CAPTCHA on the QR form, and the zod 3 → 4
migration that the remaining zod advisory needs.

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [x] `src/actions/users`: `setUserActive` bans the Supabase sign-in on turn-off
      (`ban_duration`) and lifts it on turn-on; a failed ban is logged and the profile change
      stands (`requireProfile` refuses an inactive account anyway).
- [x] `src/lib/rate-limit.ts`: `clientIp` (the host's `x-real-ip` / `x-vercel-forwarded-for`,
      else the left-most `x-forwarded-for`), `withinRateLimit(key, limit, windowMs)`: a fixed
      window counted in `public.rate_limits` by a salted SHA-256 of the IP, falling back to a
      per-copy in-memory count when the table is missing; old rows are cleared now and then.
- [x] `src/actions/emergency-reports`: `createBystanderReport` checks 30 per 10 minutes per IP
      before parsing or uploading; over it returns `{ ok: false, error, retry: true }`. Success
      now returns `ok: true`.
- [x] `src/lib/server-auth.ts`: after sweeping expired entries, the oldest are evicted until the
      cache is under 100.

### 2.2 Frontend / Components

- [x] `src/lib/access.ts`: `adminGuard` / `ertGuard` return `error` for `is_active === false`;
      `ACCOUNT_INACTIVE_MESSAGE`.
- [x] `src/components/auth/auth-provider.tsx`: a kept profile shows at once and is fetched again
      in the background; a turned-off account gets `ACCOUNT_INACTIVE_MESSAGE`; offline, the kept
      profile stays.
- [x] `src/components/auth/account-load-failed.tsx`: "Account turned off", Sign Out only.
- [x] Bystander form: a rate-limited send is queued offline with a toast; the queue treats it as
      a dropped connection (stays pending).
- [x] `next.config.ts`: `headers()` with `X-Content-Type-Options`, `X-Frame-Options: DENY`,
      `Referrer-Policy`, `Permissions-Policy`, HSTS and a `Content-Security-Policy-Report-Only`
      (Supabase, CARTO, Nominatim, Google photos; `'unsafe-inline'` scripts until a nonce).

### 2.3 Database / Dependencies

- [x] `prisma/manual/DRRM-049-rate-limits.sql` and the `RateLimit` model (`rate_limits`, RLS on).
- [x] `npm audit fix` (no `--force`): Next 16.4.3 → 16.4.6, Prisma 7.10.0 → 7.10.1 (client and
      adapter aligned), undici, systeminformation, shadcn and others. 27 → 8 findings; the rest
      need breaking upgrades (zod 4 for the app; `effect` and `minimatch` come from tooling).

---

## 3. Verification

- [x] `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`,
      `npm audit --audit-level=critical`
- [x] `next start`: `/signin` returns all six headers.
- [ ] Turn a signed-in test user off: on their next load they see "Account turned off" and can't
      sign in again; turn them on and they can.
- [ ] Bystander form sends normally; the browser console on the admin pages, the ERT form, the QR
      form and the maps shows no CSP reports (then switch the CSP to enforcing).
- [ ] Apply `DRRM-049-rate-limits.sql` on staging and production.

## 4. Review fixes (PR #130 review)

- **Sign-in ban failures reach the admin.** `setUserActive` returns `signInWarning` when the ban could not be set or lifted; the Users page shows it as an error toast. The profile change still stands. Covered by `signInBanWarning` in `src/lib/user-access.test.ts`.
- **A banned token shows "Account turned off".** Auth refuses a banned user's token in `getUser` before it expires (GoTrue `authenticateBearerToken`, checked in the source; not reproduced against a live project). `getMyProfile` returns `{ turnedOff: true }`, with no profile data, and `AuthProvider` shows the turned-off screen instead of "could not be found".
- **The shared counter is testable.** `withinRateLimit` takes the counter as a parameter; `COUNT_HIT_SQL` is the one statement run in Postgres. Tests use a stand-in table with the same rules and the fallback path. The SQL itself is not executed in tests (no Postgres in CI); its CASE expressions were checked against `nextWindow` by reading them.
- **Old phones and the rate-limit reply (not changed).** An offline queue built before this change deletes an entry when the action returns `{ ok: false }`. This is only reachable when an old bundle calls the new server. Vercel Skew Protection, if it is on for production, keeps an old bundle on its own deployment; that is a dashboard setting, not in this repo, and it is not verified here. A code guard would need a thrown error, which production hides from the new client, so it is not cheap. Follow-up: confirm skew protection.
