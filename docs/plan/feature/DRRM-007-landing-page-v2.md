# [DRRM-007] Feature Plan: Landing Page v2

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-007-landing-page-v2`
- **Owner / Author:** Bryan Mangapit
- **Design source:** Claude Design project "Wire Flow Artboard" → `DRRM-H Landing Page v2.dc.html` (web 1140 / tablet 768 / phone 390 frames)

---

## 1. Problem Statement & Motivation

The old landing page (`src/app/(public)/page.tsx`, ~1,900 lines in one client component) led with a dashboard mock and marketing copy. It described features the system no longer has (Flutter app, Incident Commander roles, protocol checklists, Encoder/Viewer roles, audit trail, cross-drill search). Hotlines were buried in the footer.

Visitors come for two things: **reporting an emergency** (anyone, no account) and **signing in** (ERT members and DRRM-H staff). v2 puts both in the hero and describes only what the system actually does.

---

## 2. Requirements & User Stories

- **As a bystander**, I want to reach the emergency report form, or call 911, from the first screen.
- **As an ERT member or DRRM-H staff member**, I want a clear sign-in entry point.
- **As any visitor**, I want to tap a hotline number to call it.

Acceptance criteria:

- [x] Hero splits by person: "Report an emergency" (→ `/bystander-report`) and "Sign in" (→ `/signin`); Call 911 sits in the nav and in the report card.
- [x] One "Who it's for" section (public / ERT members / DRRM-H office) replaces the three feature sections.
- [x] A static event-summary preview, labelled "sample data", replaces the dashboard mock and the repeated stat strip.
- [x] How it works follows a real drill in four steps.
- [x] Privacy section; "Read the full notice" opens the same `DataPrivacyContent` the forms use.
- [x] Head-of-unit quote and vision kept word for word; the mission is cut to its competence line, per the design.
- [x] Hotlines get their own tap-to-call section, with DRRM-H Center added.
- [x] Figtree + Spline Sans Mono, flat colours, no gradients; the photo carousel holds still under `prefers-reduced-motion`.
- [x] Matches the design at 1140 / 768 / 390, with no horizontal scroll down to 320px.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- No schema changes.

### Server Actions & Data Flow

- **Removed** `src/actions/landing/index.ts` (`getLandingData`) and `src/app/(public)/use-landing-stats.ts`. The design shows no live counts, so they had no callers. This also removes an unauthenticated endpoint that exposed recent event names. It makes DRRM-004 Step 2 obsolete.

### UI & User Interaction

- `src/app/(public)/page.tsx` is now a **server component** and the route prerenders as static (`○ /`). The only client island is `privacy-notice-lead.tsx` (modal state).
- Sections live in `src/app/(public)/_components/`, one file each: `hero`, `partners-bar`, `audience-section`, `summary-preview`, `how-it-works`, `privacy-section`, `quote-section`, `vision-mission`, `hotlines-section`, `access-cta`, `site-footer`.
  - `content.ts` holds all copy and data (nav links, audiences, sample summary, steps, hotlines).
  - `primitives.tsx` holds `Container`, `Section`, `SectionHeading`, `Eyebrow`, `Lead`, `CheckItem`, `ButtonLink` (the design-system 52px pill), `TextLink`, `ArrowLink`.
  - `fonts.ts` loads Figtree and Spline Sans Mono via `next/font/google`, scoped to the landing page root.
- `src/app/globals.css`:
  - `--animate-hero-fade` + `@keyframes hero-fade`: a 16s, four-photo cross-fade (CSS only).
  - `@theme inline` tokens `--font-landing` / `--font-landing-mono`. These are inlined so they resolve against the next/font variables set on the page root.
  - Smooth anchor scrolling, only on pages that carry `[data-smooth-scroll]`, and only when reduced motion is not requested.
- `src/components/common/data-privacy-notice.tsx` now exports `DataPrivacyContent`.
- Breakpoints map the design frames: phone = base, tablet = `md` (768), web = `lg` (1024). Content max width is 1140, with gutters of 20 / 40 / 64.
- Light theme only, as in the design. The admin/ERT dark mode is unaffected.

---

## 4. Implementation Tasks

- [x] Task 1: Pull the design + design-system tokens (Button, Icon → `lucide-react`, colours, type scale).
- [x] Task 2: Split the page into section components + shared primitives.
- [x] Task 3: Remove the unused landing data action/hook.
- [x] Task 4: Responsive check at 1140 / 768 / 390 / 360 / 320.

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`: no new findings (one pre-existing warning in `users/user-form.tsx`).
- [x] `npm run type-check`: clean.
- [x] `npm run build`: `/` prerenders as static.
- [x] Headless Chrome screenshots at the three design widths; no horizontal overflow at 320–1140.
- [x] Privacy notice opens from the landing page.

Open items to confirm:

- [ ] UPM Police and UP PGH share `(02) 8554-8400` (carried over from the old footer; the design flags it to confirm).
- [ ] The mission card shows one of the six mission statements, per the design.
- [ ] The existing PWA install prompt renders above the shared `Modal` (also true on the bystander form). Fix separately.
