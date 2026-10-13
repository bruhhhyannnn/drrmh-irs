# [DRRM-013] Feature Plan: UI polish after the first run

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-013-ui-polish`
- **Owner / Author:** Bryan Mangapit
- **Source:** feedback from running the redesigned app (DRRM-007 to DRRM-012) against the dev database. Stacked on `feat/DRRM-012-admin-v2`.

---

## 1. Problem Statement & Motivation

After the first run of the redesign:

- Text in the admin pages read small, especially in the main content (tables, cards, the event summary), which is what admins look at most. The same went for the ERT status report and the bystander form.
- The page loader (logo in a maroon ring) was too small to notice on a desktop screen.
- Several screens loaded with empty space or wrong placeholder text (zeros, "None reported", "has no fields yet") until their data arrived.
- The PWA install card still had the pre-redesign look, and it covered the admin bottom tabs on phones and showed on top of open drawers (open items in DRRM-007, DRRM-008 and DRRM-011).
- The redesign shipped light only. There was no dark mode, and the few `dark:` classes left from the old UI no longer matched anything.
- In the report PDF, the casualties donut sat beside its legend in a half-width card, so long condition names and long lists were squeezed into a narrow column.

---

## 2. Requirements & User Stories

- **As an admin**, I want larger text in the main content so tables and summaries are easy to read.
- **As any user**, I want loading states shaped like the content that is coming, so the page doesn't jump or show wrong numbers.
- **As a phone user**, I want the install card to match the app and stay out of the way of the navigation and drawers.
- **As any user**, I want a light or dark theme, or one that follows my device, remembered on this device.
- **As an admin**, I want the report PDF's casualty chart to stay readable with long condition names.

Acceptance criteria:

- [x] Admin main content (pages, lists, cards, event summary) uses a larger type scale. The admin shell (sidebar, rail, top bar, bottom tabs), admin drawers and dialogs keep their sizes.
- [x] The ERT status report and the bystander form use the same scale throughout, including their form controls and drawers (people, privacy, event, profile). The same controls keep their sizes in admin drawers and on the sign-in pages.
- [x] The A4 event report prints exactly as before, though it reuses the summary charts.
- [x] The page loader is 96px with a 16px label; inline spinners are a step larger.
- [x] Skeletons on: list tables (rows in the table's columns, cards on phone), list tab counts and totals, campus switcher, population fields, ERT submitted report (whole page, plus missing / casualty rows and counts), ERT form and admin report drawer (headcount steppers, damage tiles), bystander form (incident types, step 2 headcount), profile setup fields.
- [x] Install card in the design system's style: app icon, title, one line, pill buttons; the iOS hint as two numbered steps.
- [x] The card sits above the admin bottom tabs and the ERT submit bar, and under drawers and dialogs.
- [x] Light, Dark and Device themes, picked under Appearance in My profile (admins and ERT members) and saved on the device. Device follows the OS setting live. Public pages (landing, bystander form, sign-in) follow the saved choice or the device.
- [x] No flash of the light theme while a dark page loads.
- [x] Light mode looks exactly as before. The A4 event report stays light in either theme.
- [x] Report PDF: the casualties donut sits on top of its card and the condition list runs the card's full width below it; a long name wraps with its count and share on the first line.

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
- **ERT and bystander.** Files under `(ert)` and `(public)/bystander-report` take the same step-up directly. The design system controls they share with admin drawers and the sign-in pages (`components/ds/*`, `ProfileDrawer`, the landing `ButtonLink`) instead get `large-text:text-[new]` next to each size: `@custom-variant large-text` applies under `[data-large-text]`, set on the `ErtFrame` root and the bystander page root. The drawers render inside those roots (no portal), so they scale too.
  - The variant class would beat a size a page passes in through `className`; the only two such call sites (ERT damage and bystander incident-type `OptionTile`s) are on a control with no size of its own, so they are unaffected.
  - Inputs go to 17px on these pages, which also stops iOS Safari zooming in on focus (it does below 16px).
- **Loaders.** `components/ui/loader.tsx`: 96px ring, 4px stroke, 16px label. `components/ui/spinner.tsx`: sm 18px, md 24px, lg 40px.
- **Skeleton.** It moves to `components/ui/skeleton.tsx`, with an `onDark` tone for the maroon heroes; the admin `ui.tsx` re-exports it.
  - `data-list.tsx` adds `TableSkeleton`, and `ListTabs` / `ListCount` take `loading`.
  - The ERT `chrome.tsx` splits out `HeroFrame` for `HeroSkeleton`.
- **Dark mode.**
  - `globals.css`: the grey, brand and status colours (plus new `canvas`, `surface`, `line` and `brand-solid`) are CSS variables with light values on `:root` / `[data-theme='light']` and dark values on `.dark`, mapped to Tailwind through `@theme inline`. Existing classes such as `text-gray-600` work in both themes with no `dark:` variant: the grey scale flips, brand and status tints darken, and their text shades (`brand-500`, `error-700`, …) lighten. Solid status colours and hex values in class names (maroon heroes, focus ring, chart series) stay the same.
  - Codemod: `bg-white` → `bg-surface`; `border-[#eaecf0]` → `border-line`; status hex (`#b42318`, `#b54708`, `#027a48`, `#175cd3`, …) → `error-700`, `warning-700`, `success-700`, `info-700` and so on, with the same light values. Page roots use `bg-canvas`. Maroon fills with white text use `bg-brand-solid` (deep maroon in both themes), since `brand-500` turns light for text in dark mode. Inline chart colours use `var(--gray-700)` etc.
  - Exceptions: the switch knob and the dot on the selected calendar day stay white; the two dark tooltips (`bg-gray-900`) use `text-surface` so they invert cleanly; the landing footer is dark in both themes (fixed hex); the segmented control's picked option is `dark:bg-gray-300` so it stays raised.
  - `lib/theme.ts` + `store/theme.store.ts` (`useThemeStore`): preference in `localStorage` (`irs-theme`). The root layout's `<head>` script sets `.dark` before the first paint (per the Next "Preventing flash before hydration" guide). `components/theme/ThemeSync` (in Providers) re-applies it in a layout effect, follows the OS under Device, and syncs other tabs. `AppearanceSetting` is a `SegmentedControl` in `ProfileDrawer`.
  - The print page root has `data-theme="light"`. Maps drop `theme="light"`, so the vendored map switches to the Carto dark basemap. Toasts read `--surface` / `--gray-900`.
  - Removed: the old `dark:` classes in `not-found`, `~offline`, `protected-route`, `data-privacy-notice`, `ui/button`, `ui/modal`; the unused `menu-item*` utilities; the `.dark` time-picker invert (`color-scheme` handles it).
- **Report PDF donut.** `summary/charts.tsx` `Donut compact` (used only by the print page) stacks the donut above a full-width legend; legend rows align to the name's first line. The admin summary's donut is unchanged.
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
- [x] Task 6: Same scale on the ERT and bystander pages, with the shared controls scoped by `large-text`.
- [x] Task 7: Light / dark mode: theme tokens, no-flash script, Appearance setting, light print report.
- [x] Task 8: Report PDF casualties donut stacked over its list.

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
- [x] ERT form (390 / 320 / 1140), people drawer, submitted report, bystander step 1 (390 / 320) and privacy drawer: larger text, no horizontal overflow. Computed sizes: ERT section titles 19px; admin report drawer labels and sign-in labels still 14px. Bystander steps 2 and 3 were not walked through (step 1 needs a pinned location); they use the same controls and stepper rows as the ERT form.
- [x] Dark mode, through the same preview route with sample data in the TanStack cache (the dev database was refusing connections, `P1017`): dashboard (1280 and 390), events, profile drawer, landing, bystander step 1 (390), sign-in, all in dark; dashboard in light matches before. Appearance switch: Light / Dark / Device set and clear `irs-theme` and the `dark` class; a saved Dark survives a reload with a light OS; Device follows the emulated OS setting. Inside `[data-print-report]` with `.dark` on `<html>`, the computed colours are the light ones. No horizontal overflow, no console errors. ERT form and the full print report weren't rendered (both need live data).
- [x] Report PDF donut with eight conditions, several of two or three lines, in the half-width card: donut centred on top, every row readable, counts and shares aligned.

Rollout: deploy. Nothing to run in Supabase.

Open items:

- [ ] Sign-in pages, profile setup, admin drawers and dialogs keep their sizes. To scale one, add `data-large-text` to its root (the shared controls follow) and step up its own sizes.
- [ ] At 320px the longer headcount labels on the ERT form wrap to two or three lines next to the stepper.
- [ ] `npm run dev` (Turbopack, Next 16.4.0) showed a `next/font/google` "Can't resolve '@vercel/turbopack-next/internal/font/google/font'" error in this environment; `next dev --webpack` and the production build were fine.
