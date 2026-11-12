---
type: feature
ticket: DRRM-039
status: done
branch: feat/DRRM-039-google-profile-photos
modules:
  - '[[users]]'
  - '[[auth]]'
tags: [plan, feature, design-round-2026-11-11]
---

# [DRRM-039] Feature Plan: Google profile photos for users

- **Status:** `[Done]`
- **Target Branch / PR:** `feat/DRRM-039-google-profile-photos`
- **Owner / Author:** Bryan Mangapit

> Design source: the screenshots below are the whole design. Don't open the Claude Design canvas for this ticket; it also holds older turns (1–8) that are already built.
> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`. Afterwards update the module notes listed in `modules:` and add a line to `docs/changelog.md`.

---

## 1. Problem Statement & Motivation

Admins recognise members by face more easily than by name. Most members sign in with Google, which has a profile photo. The app shows initials only.

---

## 2. Design

![SA57 users with photos](../../design/2026-11-11-admin-polish/SA57-users-photos.png)

![SA50 reports Reported by with photos](../../design/2026-11-11-admin-polish/SA50-reports-list.png)

---

## 3. Requirements & Acceptance Criteria

**Saving the photo URL**

- [x] Add `users.avatar_url String?` via `prisma/manual/DRRM-039-avatar-url.sql` plus the schema edit.
- [x] At every sign-in, set it server side from the verified session's `user_metadata.avatar_url` (or `picture`). Never trust a client-sent value.
- [x] Email-and-password and off-campus accounts have none.

**Showing it**

- [x] `Avatar` (`src/app/(admin)/_components/ui.tsx`) takes `src` and renders `<img referrerPolicy="no-referrer" loading="lazy">`.
- [x] It falls back to initials on error.
- [x] Used on Users (40px), Reports' Reported by (36px) and the account menu. Admin pages only.

**Caching**

- [x] Don't copy images into our storage.
- [x] Exclude `lh3.googleusercontent.com` from next-pwa runtime caching.

**Privacy (Data Privacy Act of 2012)**

- [x] Add a line to the data privacy notice: profile photo from Google, shown to DRRM-H admins to recognise members.
- [x] Add a "Show my Google photo" switch to My profile (default on). When off, initials show.
- [ ] Confirm with the UP Manila Data Protection Officer before release. (Yours to do: it isn't something the code can settle.)

---

## 4. Technical Design

- Sign-in flow: [`src/components/auth/auth-provider.tsx`](../../../src/components/auth/auth-provider.tsx) and the profile action that runs after sign-in (see `docs/modules/auth.md`).
- Users list action: include `avatar_url`.

---

## 5. Implementation Tasks

- [x] SQL + schema + save at sign-in
- [x] Avatar `src` + fallback; use in Users, Reports, account menu
- [x] Privacy notice line + profile switch
- [x] PWA cache exclusion
- [x] Update `docs/modules/users.md` and `auth.md`

---

## Notes from the build

- **Apply `prisma/manual/DRRM-039-avatar-url.sql`** (`users.avatar_url` and `users.show_avatar`). The code is safe to deploy first: both columns are left out of default reads (`omit` in `src/lib/prisma.ts`) and `src/lib/avatars.ts` tolerates them missing, so initials show and nothing is saved until it runs.
- The switch needs its own column, `show_avatar` (default on), which the plan didn't list.
- Only `https` photo URLs on `googleusercontent.com` from a Google sign-in are saved (`googlePhoto`, 3 tests), so a client can't make the app show an arbitrary image.
- `getAvatars` is admin-only; photos stay on admin pages (and in the user's own account button and My profile).
- Checked in a temporary preview: a photo beside Reported by, a broken photo falling back to the initials, and the photo in the account button.

## 6. Out of Scope

- Photos for bystanders (anonymous).
