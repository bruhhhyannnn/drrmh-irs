# [DRRM-013] Feature Plan: UI polish after the first run

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-013-ui-polish`
- **Owner / Author:** Bryan Mangapit
- **Source:** feedback from running the redesigned app (DRRM-007 to DRRM-012) against the dev database. Stacked on `feat/DRRM-012-admin-v2`.

---

## 1. Problem Statement & Motivation

After the first run of the redesign:

- Text in the admin pages read small, especially in the main content (tables, cards, the event summary), which is what admins look at most.
- The page loader (logo in a maroon ring) was too small to notice on a desktop screen.
- Several screens loaded with empty space or wrong placeholder text (zeros, "None reported", "has no fields yet") until their data arrived.
- The PWA install card still had the pre-redesign look, and it covered the admin bottom tabs on phones and showed on top of open drawers (open items in DRRM-007, DRRM-008 and DRRM-011).

---

## 2. Requirements & User Stories

- **As an admin**, I want larger text in the main content so tables and summaries are easy to read.
- **As any user**, I want loading states shaped like the content that is coming, so the page doesn't jump or show wrong numbers.
- **As a phone user**, I want the install card to match the app and stay out of the way of the navigation and drawers.

Acceptance criteria:

- [x] Admin main content (pages, lists, cards, event summary) uses a larger type scale. The shell (sidebar, rail, top bar, bottom tabs), drawers and dialogs keep their sizes.
- [x] The A4 event report prints exactly as before, though it reuses the summary charts.
- [x] The page loader is 96px with a 16px label; inline spinners are a step larger.
- [x] Skeletons on: list tables (rows in the table's columns, cards on phone), list tab counts and totals, campus switcher, population fields, ERT submitted report (whole page, plus missing / casualty rows and counts), ERT form and admin report drawer (headcount steppers, damage tiles), bystander form (incident types, step 2 headcount), profile setup fields.
- [x] Install card in the design system's style: app icon, title, one line, pill buttons; the iOS hint as two numbered steps.
- [x] The card sits above the admin bottom tabs and the ERT submit bar, and under drawers and dialogs.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- None.

### Server Actions & Data Flow

- None. Skeletons read `isPending` / `isLoading` from the existing TanStack Query hooks. The public bystander form's headcount uses `isLoading`, so a paused offline query doesn't show a placeholder.

### UI & User Interaction

- **Type scale.** In admin main content every `text-[Npx]` steps up: 10→11, 11→12, 12→13, 13→14, 14→16, 15→17, 16→18, 17→19, 18→20, 20→22, 24→26, 26→28, 28→30, 30→32, 32→34. Body text (14px) gets +2 and secondary text +1, so the gap between them grows slightly.
  - Files: `_components/{ui,page-header,data-list}.tsx`, `_components/summary/*`, the dashboard, campus, events, reports, bystander reports, users and settings pages.
- **Print report.** `globals.css` adds `@custom-variant print-report`, and the print page's root carries `data-print-report`. In `summary/charts.tsx` each size is written as `text-[new] print-report:text-[old]` (the ranked-bar value column as `w-21 print-report:w-18`), so the A4 layout is unchanged.
- **Loaders.** `components/ui/loader.tsx`: 96px ring, 4px stroke, 16px label. `components/ui/spinner.tsx`: sm 18px, md 24px, lg 40px.
- **Skeleton.** It moves to `components/ui/skeleton.tsx`, with an `onDark` tone for the maroon heroes; the admin `ui.tsx` re-exports it.
  - `data-list.tsx` adds `TableSkeleton`, and `ListTabs` / `ListCount` take `loading`.
  - The ERT `chrome.tsx` splits out `HeroFrame` for `HeroSkeleton`.
- **Install card.** `components/pwa/install-prompt.tsx`, at `z-35`: above page content, under the bottom tabs (z-40), drawers (z-50) and dialogs (z-60).
  - Bars along the bottom edge carry `data-bottom-bar` (admin bottom tabs, ERT submit bar). The card measures them while it is visible and sits 12px above.
  - It imports the design system by direct paths: the card is mounted on every page, and the `ds` index pulls in the map.

---

## 4. Implementation Tasks

- [x] Task 1: Type scale in admin main content; print variant for the shared charts.
- [x] Task 2: Larger Loader and Spinner.
- [x] Task 3: Shared Skeleton and the new loading states.
- [x] Task 4: Install card redesign and placement.
- [x] Task 5: Responsive check at 1140 / 390 / 320.

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`: clean.
- [x] `npm run type-check`: clean.
- [x] `npm run build`: passes.
- [x] Headless Chrome walk-through through a temporary preview route (deleted) that signed in a fake Super Admin / ERT member and read the dev database (no writes):
  - Pages: dashboard, events, event details, reports at 1140, 390 and 320.
  - Skeletons, captured by holding server-action requests: events list (web and phone), ERT form, ERT submitted report, profile setup, bystander step 1.
  - Install card: Chrome variant on web and phone, above the bottom tabs and the ERT submit bar; iOS variant at 390 and 320.
  - No horizontal overflow, no console errors.
- [x] Print report: inside `[data-print-report]` the chart text computes to the old sizes (e.g. 12px for `text-[13px] print-report:text-[12px]`).

Rollout: deploy. Nothing to run in Supabase.

Open items:

- [ ] ERT, bystander and auth pages keep their sizes; apply the same scale there if they also read small.
- [ ] Drawers and dialogs keep their sizes; their fields are shared with the ERT and bystander forms.
- [ ] `npm run dev` (Turbopack, Next 16.4.0) showed a `next/font/google` "Can't resolve '@vercel/turbopack-next/internal/font/google/font'" error in this environment; `next dev --webpack` and the production build were fine.
