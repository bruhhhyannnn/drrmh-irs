---
type: feature
ticket: DRRM-021
status: in-review
branch: feat/DRRM-021-landing-partners
modules:
  - '[[pillars-and-landing]]'
tags: [plan, feature]
---

# [DRRM-021] Feature Plan: Landing page, turning campus names and new partners

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-021-landing-partners` → `dev`
- **Owner / Author:** Bryan Mangapit
- **Design source:** Claude Design project → `IRS Landing v2.dc.html` (the only file edited in this round)

---

## 1. Problem Statement & Motivation

The system now serves more than UP Manila, and the UP Resilience Institute and NOAH Center work on it with the DRRM-H Program. The landing page still named only UP Manila in the hero and credited the IRS itself in the partners bar. The design was updated with small changes, and the code follows it.

---

## 2. Requirements & User Stories

- **As a visitor**, I want the landing page to show which campuses use the system and who builds it.
- Key acceptance criteria:
  - [x] The hero heading reads "Incident reporting for …" with UP Manila, PGH, UP Diliman and UP System taking turns (3 s each, a 12 s loop), in the light pink of the design.
  - [x] Screen readers hear "Incident reporting for UP Manila, PGH, UP Diliman and UP System" once; with reduced motion only UP Manila shows.
  - [x] The partners bar keeps "Developed under the DRRM-H Program" with UP Manila and DRRM-H Center, drops the IRS logo, and adds the UP Resilience Institute (logo and name) and the NOAH Center wordmark after a divider (divider on web widths only).
  - [x] The NOAH wordmark (black letters) stays readable on the dark theme.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- None. The landing page is static.

### UI & User Interaction

- `src/app/(public)/_components/content.ts`: `HERO_CAMPUSES`, `PARTNER_INSTITUTES`; `PARTNERS` loses the IRS entry.
- `src/app/(public)/_components/hero.tsx`: `CampusTurns`, the names stacked in one grid cell so the heading doesn't shift between names; the `h1` carries the `aria-label`.
- `src/app/globals.css`: `--animate-campus-turn` and the `campus-turn` keyframes, from the design's `irsCampus`.
- `src/app/(public)/_components/partners-bar.tsx`: two groups and the divider; NOAH on a `data-theme="light"` chip, which is invisible on the light theme.
- `public/upri-logo.png` (scaled from 2750 to 400 px, like the other logos) and `public/noah-logo.png` (284 × 100).

---

## 4. Implementation Tasks

- [x] Hero heading and its animation
- [x] Partners bar and logos
- [x] Verify: lint, type-check, `npm run build`; in headless Chrome at 1280, 768 and 390 px: each name shows at 1.5, 4.5, 7.5 and 10.5 s into the loop, the `aria-label`, no sideways scroll, the divider only at 1280, logos load, the dark theme, and reduced motion (UP Manila only, no running animation).

## 5. Notes

- The design also has a "Credits" option that labels the partner group "Developed by" or "In partnership with" and adds a matching footer line. Its default is no label, which is what ships; the label can be added later if wanted.
