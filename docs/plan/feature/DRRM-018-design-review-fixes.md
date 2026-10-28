---
type: feature
ticket: DRRM-018
status: in-review
branch: feat/DRRM-018-design-review-fixes
modules:
  - '[[design-system]]'
  - '[[users]]'
  - '[[events]]'
  - '[[field-reports]]'
  - '[[bystander-reports]]'
  - '[[auth]]'
  - '[[routes]]'
  - '[[print]]'
  - '[[settings-lookups]]'
tags: [plan, feature]
---

# [DRRM-018] Feature Plan: Design review fixes (October 26)

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-018-design-review-fixes` → `dev`
- **Owner / Author:** Bryan Mangapit
- **Design source:** Claude Design project → "Fixes from testing" in `IRS - Super Admin.dc.html` (SA2b, SA6, SA11b, SA14b, SA15, 5a), `IRS - Admin.dc.html` (AD2b, AD3, AD8b, AD11b, AD12), `IRS - ERT.dc.html` (8a, 10), `IRS - Bystander.dc.html` (26a) and `IRS - Auth Screens.dc.html` (29). Assessment and pillar screens are out of scope.

---

## 1. Problem Statement & Motivation

Testing the redesign (DRRM-007 to DRRM-014) turned up a list of fixes, reviewed on October 26 and drawn in the role files: the browser's own select looked out of place next to the 48px fields, several inputs had no placeholder, Unit was required where some clusters have none, a failed Delete user showed React's minified error, phone users couldn't reach Campus, Users or Settings comfortably from the More sheet, the Events row still exported Excel while event details exported the PDF, and there was no way to collect the app evaluation from reporters.

---

## 2. Requirements & User Stories

- **As an admin**, I want the Events row download to save the same PDF as event details, so there is one report.
- **As an admin**, I want every field of Add user to show an example, and the name in First, Middle, Last, Suffix order so Tab follows reading order.
- **As anyone filling a form**, I want selects that look like the rest of the form and work with the keyboard.
- **As an ERT member or admin**, I want Unit to be optional, with a way to name a unit (or position) that isn't listed.
- **As an admin on a phone**, I want a More page with every page the sidebar has, my profile, Appearance and Sign out.
- **As an admin**, I want a failed delete to say plainly that nothing changed and let me try again.
- **As a reporter**, I want to be asked once after sending whether I'll rate the app, without being nagged after I have.

Acceptance criteria:

- [x] Events: the row's download icon (and the phone card's button) is Export PDF and opens `/events/report?id=`. The Excel export (`export-event.ts`) and the helpers only it used are removed.
- [x] Add user: placeholders in every field; Name is First, Middle, Last, Suffix. Placeholders added to the population field form (Name, Code), the sign-in password and both Update password fields.
- [x] One custom `Select` (`src/components/ds/select.tsx`) behind `SelectField` and `FilterSelect`, and in place of the two raw `<select>`s (campus details event picker, event summary Compare with). The 48px field, a maroon ring and turned chevron while open, a list card with the current item ticked, a rule before Other. Arrow keys, Home / End, Page Up / Down, Enter, Space, Escape (closes only the list) and type-to-jump. The list is portalled, flips above the field when there's no room, and copies the large type scale and a forced light theme from where the field sits.
- [x] Unit is optional in Add / Edit user, Edit / Add report and profile setup. Its list starts with No unit and ends with Other (please specify), which opens a Unit name (Specify unit) field. Position in Add / Edit user works the same way. The typed name is matched case-insensitively against existing units (in that cluster) or positions, and added when new.
- [x] Delete user: on failure the dialog stays open with a red box ("… was not deleted.") and Try again; the raw error goes to the console. The cause is fixed: `deleteUser` now detaches events as well as reports, in one transaction, and returns a plain reason instead of failing when the user evaluated building assessments.
- [x] Phone: the More tab opens `/more` (pages that aren't bottom tabs, by sidebar group; My profile; Appearance; Sign out; version). Pages opened from it show a More back link above the title on phone.
- [x] The event report is white with dark text whatever the app theme, its scrollbar and print colour scheme included.
- [x] Rate the app: after a report sends (ERT or bystander, straight away or from the offline queue), a popup links to the Google Forms evaluation. Not now / close wait for the next report; opening the form stops it asking on that device. Rate the app is also in the ERT account menu.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

No schema changes. `users.unit_id`, `reports.unit_id` and `bystander_reports.unit_id` were already nullable. Typed units and positions use the existing `units (name, cluster_id)` and `positions (name)` uniques.

### Server Actions & Data Flow

- `src/lib/lookup-names.ts` (server only): `unitIdForName(clusterId, name)`, `positionIdForName(name)`.
- `src/actions/users`: `CreateUserInput` gains `custom_unit_name` / `custom_position_name`, resolved by `withNamedAssignment` in `createUser`, `updateUser` and `completeUserProfile` (which also takes `custom_unit_name`). `deleteUser` returns `DeleteUserResult` (`{ ok: true } | { ok: false, error }`).
- `src/actions/reports`: `reportSchema` gains `unit_name`; `createReport` and `saveReportEdits` resolve it, so an offline-queued report still carries everything in one payload.
- Removed: `getReportsByEvent`, `sumPopulationCountsByCategory`, `uniquePopulationCategories` (only the Excel export used them), and the `exceljs` dependency.

### Decisions (agreed 2026-10-27)

- "Other (please specify)" reuses a unit (in that cluster) or position with the same name in any case, or adds it to Settings; no free-text column. New rows can appear in Settings this way.
- The bystander form gets No unit but no Other: anonymous reporters don't add Settings rows.
- A user who evaluated building assessments can't be deleted (each assessment keeps its evaluator); the dialog says so and points to turning off Active.
- Assessment and pillar code is untouched; their selects take the new `Select` through the shared `SelectField` / `FilterSelect`.

### UI & User Interaction

- `src/components/ds/select.tsx` (`Select`, `SelectOption`, `OTHER_VALUE`, `OTHER_OPTION`); `SelectField` gains `emptyLabel`.
- `src/components/ds/rate-app-dialog.tsx`, `src/store/rate-app.store.ts`, `src/lib/rate-app.ts` (`RATE_APP_URL`, `RATED_APP_KEY`).
- `src/app/(admin)/more/page.tsx`, `src/app/(admin)/_components/shell/more-back-link.tsx`, `nav.ts` (`MORE_HREF`, `moreGroups`, `isMorePage`, item `description`).
- `ConfirmDialog` gains `error` and `confirmDisabled`. `useSignOut` (`src/components/auth`) is shared by My profile and More.
- Phone card buttons size to their labels (icons drop under 360px), so "Export PDF" fits at 320px.

---

## 4. Implementation Tasks

- [x] Custom select and its rollout
- [x] Events Export PDF, Excel export removed
- [x] Placeholders and the Add user field order
- [x] Unit optional with No unit / Other (users, reports, profile setup) and Position Other
- [x] Delete user failure dialog and the `deleteUser` fix
- [x] Phone More page and back link
- [x] Event report light theme
- [x] Rate the app popup and menu item
- [x] Docs (this plan, module notes)

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`, `npm run type-check`, `npm run test` (62 pass), `npm run build`.
- [x] Screens checked in headless Chrome through a temporary preview route (removed): Add user (web, phone, dark, keyboard), Unit list with No unit / Other, profile setup, More page, Users filters, Events at 360 and 320px, Rate the app (web, phone), the delete failure, the bystander campus select, the event report in dark mode on screen and in print media.
- [ ] Not checked in the browser: the More back link on the real `/users` / `/settings` routes (the preview route isn't one of them), and a real Delete user against the database.
- [x] `exceljs` removed from `package.json` and the lockfile (`npm uninstall exceljs --package-lock-only`): it and the 80-odd packages only it needed. No other version changed; `npm ls --package-lock-only` is clean.
