---
type: review
ticket: REV-2026-10-12
status: done
branch: feat/DRRM-012-admin-v2
modules:
  - '[[design-system]]'
  - '[[database]]'
tags: [plan, review]
---

# [REV-2026-10-12] Code Review & Audit: Unused code and packages (knip)

- **Review Date:** 2026-10-12
- **Target Branch / PR / Files:** `feat/DRRM-012-admin-v2` (whole `src/` and `package.json`)
- **Reviewer:** Bryan Mangapit
- **Status:** `[Completed]`
- **Overall Recommendation:** `[Approve]`

---

## 1. Executive Summary

`npx knip` (5.87) after the redesigns (DRRM-007–012) reported 1 unused file, 8 unused packages, 74 unused exports and 9 unused exported types. Most of it was left behind by the old template UI that the redesigns replaced. Every finding was checked by hand (usages across `src/` and `prisma/`, barrels, configs, CSS imports) before removal. A second knip pass found what the first round left unused (three server actions and `@tanstack/react-table`). Knip now reports nothing.

---

## 2. What was removed

### Files (11)

- `src/components/dashboard/event-calendar.tsx`: the old dashboard calendar, not imported anywhere.
- `src/components/common/page-breadcrumb.tsx`: not imported.
- `src/components/ui/{badge,confirm-dialog,data-table,dropdown,form,pagination,table,table-actions}.tsx`: the old template's table, form and dialog kit. Only reachable through the `components/ui` barrel, and only from each other (and the calendar above). The admin pages use `(admin)/_components` and `components/ds` instead.

### Code

- Hooks with no callers: `useCampus` in `use-campus.ts` (pages use the one in `use-settings.ts`), `useCreateEvent`, `useCreateBystanderReport`, `useCreateReport`, `useUpdateReport`, `useEventReports`. The forms call `createReport` / `createBystanderReport` directly (through the offline queue).
- Server actions left without callers: `getCampus` (campus-table; settings has its own), `createEvent` (Add event uses `createEvents`), `updateReport` (Edit report uses `saveReportEdits`), `upsertDamageCondition`. Fewer exposed server endpoints, which matters while actions have no server-side role check.
- `PageError` (spinner), the `DataPrivacyNotice` wrapper (the landing page and bystander form use `DataPrivacyContent` and the notice constants), `LOCATIONS` (constants), `locationSchema`, `userTypeSchema`, `UserEditFormData`, `PopulationCountEntry`, `QueuedBystanderReport`.
- Barrel re-exports nobody imports: `GoogleSignInButton` (auth barrel; imported by path), `conditionSummary` / `plural` (ds barrel), `personMeta` / `plural` / `UNKNOWN_PERSON` (bystander `_lib/summary`).
- Symbols only used in their own file are no longer exported (no behaviour change): `NAV`, `LOOKUPS`, `SettingsTab`, `useConditionLists`, `casualtyLevel`, `damageLevel`, `isNoDamage`, `SummaryReport`, `BystanderStatusName`, `CardAction`, `ReportDraft`, `ADMIN_USER_TYPES`, `AdminUserType`, `stripJpegMetadata`, `userBaseSchema`, `populationCountEntrySchema`.

### Packages (9)

- `recharts`, `nodemailer`, `@types/nodemailer`: no references anywhere (the summary charts are hand-built).
- `@tanstack/react-table`: only used by the removed `ui/data-table.tsx`.
- `eslint-config-next` (v15, while the app is on Next 16): `eslint.config.mjs` doesn't use it, and Next 16 no longer lints during `next build`.
- `@hugeicons/core-free-icons`, `@hugeicons/react`, `class-variance-authority`, `radix-ui`: added by `shadcn init` when the map was installed (e54d7fd); no file imports them, and `map.tsx` uses only `maplibre-gl` and `lucide-react`. `components.json` still names hugeicons and the radix style, and `npx shadcn add` installs a component's dependencies when it is added. `shadcn` itself stays (`globals.css` imports `shadcn/tailwind.css`).

`npm uninstall` changed the lockfile by removals only: no remaining package changed version.

---

## 3. Kept on purpose

- `src/components/ui/map.tsx` exports (`MapArc`, `MapPopup`, `MarkerTooltip`, …): vendored from mapcn and kept as published. `knip.json` ignores the file so knip stays clean.

---

## 4. Verification

- [x] `npx knip`: no issues.
- [x] `npm run lint`, `npm run type-check`: clean.
- [x] `npm run build`: passes, all 26 routes generated.

## 5. Follow-ups

- [ ] `npm audit --audit-level=critical` (a CI step) reports 3 critical advisories, in `next`, `maplibre-gl` and `proxy-addr`. They were there before this cleanup (same three on the old lockfile). Removing the packages cut high-severity findings from 17 to 14. Upgrading `next` / `maplibre-gl` needs its own change and testing.
