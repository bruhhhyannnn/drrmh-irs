# [DRRM-009] Feature Plan: Auth Pages v2

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-009-auth-pages-v2`
- **Owner / Author:** Bryan Mangapit
- **Design source:** Claude Design project → `DRRM-H Redesign - Sign-in.dc.html` (screens 5, 32, A1–A6, 29: web 1140 / tablet 768 / phone 390).

---

## 1. Problem Statement & Motivation

Sign-in, forgot password, update password and first-time profile setup each had their own layout: a card floating over a photo, with errors in two places (one inside the Google block, one above the email form) and the bystander link competing with sign-in. A Google timeout landed on a bare error page, and profile setup was a modal that couldn't be closed, sitting over the report page.

The redesign puts every auth screen in one frame (photo panel + form), so only the right-hand content changes, and gives the reset screens one pattern: icon, title, one line, one main button.

---

## 2. Requirements & User Stories

- **As an ERT member**, I want Google sign-in first, and a clear retry when it times out.
- **As an admin**, I want to sign in with email and password, see what went wrong in one place, and reset my password without retyping my email.
- **As a new ERT member**, I want to set up my profile on a proper page, and sign out if this isn't my account.

Acceptance criteria:

- [x] Web is split: campus photos (cross-fading, still with reduced motion) and logos on the left, the form on white. Tablet and phone stack the photo as a short header.
- [x] "Report an incident" sits on the photo panel on web and below the form on tablet and phone, on the sign-in screens only.
- [x] Google comes first with "UP accounts only (up.edu.ph)"; email sits below an "or with email" divider.
- [x] The password step shows the email as a chip with Change, instead of a read-only field plus Back.
- [x] "Forgot password?" sits on the Password label row and carries the email over.
- [x] Errors are one banner above the fields, and the password field outline turns red.
- [x] A Google timeout (10 s on the callback) is an amber banner on the normal sign-in; the same Google button is the retry. Domain and provisioning failures use the same banner.
- [x] Check your email: "send again" counts down 60 s (Supabase's default rate limit), then turns maroon and calls `resetPasswordForEmail` again.
- [x] Update password confirms "Passwords match" as soon as the zod check passes.
- [x] Link expired: Request a new link (→ forgot password) and Back to sign in.
- [x] Profile setup is a full page instead of a modal, with "Not you? Sign out". Save stays off until every field is filled, with a line saying what's missing. Building / Unit is required.
- [x] Light theme, Figtree + Spline Sans Mono, no horizontal scroll from 320px up.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

No schema changes.

### Server Actions & Data Flow

- No new actions. `completeUserProfile` now always receives `unit_id` when the cluster has units.
- `src/app/auth/callback/page.tsx`: the 10 s timeout redirects to `/signin?error=timeout`; a provisioning failure signs out and redirects to `/signin?error=setup`. The callback page itself is now only a spinner.

### UI & User Interaction

- `src/components/ds/` (new, shared): the design-system controls moved out of the bystander form — `fields` (adds a `ghost` button, disabled styling, `ButtonLink`, `PasswordInput`, a `FieldLabel` `action` slot), `drawer`, `fonts`, `focus`. The bystander form and landing page import from here.
- `src/components/auth/`:
  - `auth-shell.tsx` (replaces `auth-header.tsx`): the split / stacked frame. Reuses the landing hero's `hero-fade` keyframes.
  - `auth-ui.tsx`: `AuthHeading`, `AuthBanner` (error / warning), `StatusIcon`, `BackLink`, `AUTH_LINK`.
  - `google-sign-in-button.tsx` (replaces `google-sign-in-form.tsx`): reports errors to the page's banner.
  - `profile-setup.tsx` (replaces `complete-profile-modal.tsx`): `ProfileSetup` page and `ProfileSetupGate`, used by the admin layout and the ERT report page.
- `src/app/(auth)/`: `signin`, `forgot-password` (now reads `?email=`), `update-password` rebuilt on the shell. Pages set their own titles.

---

## 4. Implementation Tasks

- [x] Task 1: Move shared controls to `src/components/ds`.
- [x] Task 2: Auth shell, banner and result-screen pieces.
- [x] Task 3: Sign in (email → password), forgot password, check your email, update password, link expired, password updated.
- [x] Task 4: Profile setup page + gate; callback errors as sign-in banners.
- [x] Task 5: Responsive check at 1140 / 768 / 390 / 320.

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`: no new findings (one pre-existing warning in `users/user-form.tsx`).
- [x] `npm run type-check`: clean.
- [x] `npm run build`: passes; `/signin`, `/forgot-password` and `/update-password` prerender as static. (The first run stopped with `ENOSPC` on a full disk; re-run once space was freed.)
- [x] Headless Chrome walk-through at 1140 / 768 / 390 / 320 with Supabase auth calls stubbed (no real sign-ins or reset emails): sign in, timeout banner, email validation, wrong password, forgot password (email carried over), check your email, link expired. Update password (A4) and profile setup (29) were checked through a temporary preview route, since they need a recovery link or a signed-in user. No horizontal overflow at any width.
- [ ] Not run: a real Google sign-in, a real reset email, and saving a profile against the database.

Deviations from the design:

- A cluster with no buildings / units would make profile setup impossible to finish, so Building / Unit is only required when the chosen cluster has units (shown as "Not needed" otherwise).
- The invalid field outline uses the shared error red (`#b42318`) rather than the design's lighter `#fda29b`, for contrast.

Open items:

- [ ] `next dev` (Next 16) appends an agent-rules block to `CLAUDE.md`; it is left out of this branch.
