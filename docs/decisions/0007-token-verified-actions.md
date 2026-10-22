---
type: decision
id: '0007'
status: accepted
date: 2026-10-22
modules:
  - '[[auth-and-profiles]]'
  - '[[assessments]]'
  - '[[assessment-admin]]'
  - '[[campus-scoping]]'
tags: [decision]
---

# 0007 New server actions verify the caller's Supabase token

## Context

The older actions take a user id or campus id from the client and trust it. Server actions are reachable as POST endpoints, so a signed-in user could send another user's id or another campus.

## Decision

`src/actions/assessments`, `assessment-admin`, `assessment-templates` and `building-safety` take the Supabase access token (`getAccessToken()` in `src/lib/supabase.ts`) and verify it on the server (`src/lib/server-auth.ts`):

- `requireProfile(token)` returns the caller's profile, which becomes the assessment's evaluator.
- `requireAdmin(token, campusId)` with `adminScope` (`src/lib/admin-scope.ts`) gives an Administrator their own campus whatever the request says. A Super Admin gets the campus they asked for, or all campuses.
- Who may use the assessment is decided only by `canUseAssessment()` in `src/lib/access.ts`.

Expected failures come back as `{ ok: false, error, retry }` instead of being thrown. `retry: true` (signed out, or another account on the phone) leaves an offline entry pending.

## Consequences

- The client can't fake the campus lock or the evaluator.
- Old-style and token-checked actions exist side by side until the older domains are moved over.
- The offline queue fetches a fresh token when it flushes (`OfflineQueueProvider` calls `getAccessToken()` per send), not when the entry was queued.

## Links

- [[plan/feature/DRRM-015-phase-1-plan]] · [[plan/feature/DRRM-015-phase-2-plan]] · `531ddc4` (2026-10-20)
