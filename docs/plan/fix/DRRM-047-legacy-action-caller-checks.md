---
type: fix
ticket: DRRM-047
status: in-review
branch: fix/DRRM-047-legacy-action-caller-checks
modules:
  - '[[events]]'
  - '[[bystander-reports]]'
  - '[[campus-scoping]]'
  - '[[settings-lookups]]'
  - '[[dashboard]]'
  - '[[field-reports]]'
tags: [plan, fix, security]
---

# [DRRM-047] Fix Plan: Caller checks on the older actions

- **Status:** `[In Review]`
- **Related Bugs / Audits:** GitHub #102, #103
- **Target Branch / PR:** `fix/DRRM-047-legacy-action-caller-checks`
- **Author:** Bryan Mangapit

---

## 1. Objective & Scope

The older action modules still had no caller check, and several forwarded a client-built Prisma
object straight to Prisma (#102). Settings writes checked for an admin but not the campus or the
role, and passed `Record<string, unknown>` to Prisma (#103). Because a server action is a public
POST endpoint, anyone could delete events (and their reports and photos), read bystanders' phone
numbers and casualties' diagnoses, or use a nested write (`{ users: { updateMany: … } }`) to
deactivate or promote accounts.

This plan finishes the move to token-verified actions ([[0007-token-verified-actions]]) for
events, bystander reports, campuses, population fields, the dashboard and Settings. The report
reads in #102 were done in DRRM-046.

Non-goals: the database layer (RLS, indexes) and the remaining races, in DRRM-048.

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

Every action below takes the token first. Admin reads use the campus from `requireAdmin` (an
Administrator's own, a Super Admin's pick or all); single-row actions load the row and check
`inScope`. Ids are checked with `isUuid`. Writes return `{ ok: true, … } | { ok: false, error }`.

- [x] `src/actions/events`: `eventWriteSchema` (strict) replaces the `Prisma.Event*Input`
      parameters. `createEvents` checks every campus; `user_id` and `completed_by` come from the
      caller, as does the end time on completion. `updateEvent` checks the event and its new
      campus and works out the completer on the server. `completeEvents(token, ids)` refuses all
      if any event is outside the scope. `deleteEvent`, `getEvent`, `getEvents`,
      `getOngoingEventOptions`, `getCampusEventOptions`, `getEventSummarySource` (null outside the
      scope), `getSiblingOngoingEvents` (Super Admins only). `getOngoingEvents` gives a member
      their own campus, an admin their scope.
- [x] `src/actions/emergency-reports`: the QR submit and incident types stay public. The list
      (capped at 500, newest first; returns `{ reports, truncated, limit }` so the page can say so),
      pending count, status (runtime allowlist), delete (now also removes the photos from Storage),
      signed photo URLs and mark-seen check the caller and scope.
- [x] `src/actions/campus-table`: overviews for admins in scope; `createCampus`, `updateCampus`,
      `deleteCampus` for Super Admins with `campusSchema.strict()`. Names, logos and a campus's
      clusters stay public.
- [x] `src/actions/population-categories`: writes for admins in scope, strict allowlists
      (`populationCategoryCreateSchema`, `populationCategoryUpdateSchema`,
      `campusPopulationLinkUpdateSchema` in `src/lib/schemas.ts`); the code is fixed once made. An
      Administrator may edit a field only while no other campus links to it and no other campus's
      report or bystander report has a headcount for it (`canEditPopulationField`,
      `src/lib/population-field-access.ts`, owner decision on #102); a Super Admin, any.
      `addCampusPopulationCategory` locks the campus row while picking the next place (#108 item 3
      for this action); a reorder must name links of one campus in scope (at most 100). Every
      write wraps its Prisma call in `toFriendlyError`. Reads stay public.
- [x] `src/actions/dashboard`: `getDashboard(token, …)`, campus from the scope; returns `ok: true`.
      It loads only ongoing, upcoming and this month's events and counts statuses with a `groupBy`
      (#109 item 4, here because it is the same function).
- [x] `src/actions/settings`: `getSettingsItems` for admins, scoped to the Administrator's campus
      for clusters, units and buildings. Writes parse the table's strict schema
      (`settingsWriteSchemas` in `src/lib/schemas.ts`) and go through `canWriteSetting`
      (`src/lib/settings-access.ts`): campuses are Super Admin only; positions, casualty and damage
      conditions are shared lists that any admin may change (owner decision on #103); clusters,
      units and buildings need both the saved row's campus and the new parent's campus in scope.
      Names lose control characters (#111).
- [x] `src/lib/utils.ts`: `ActionRefusal`, `okOrThrow` (hooks throw the refusal in the browser).

### 2.2 Frontend / Components

- [x] Hooks (`use-events`, `use-bystander-reports`, `use-campus`, `use-population-categories`,
      `use-dashboard`, `use-settings`) pass `await getAccessToken()` and unwrap with `okOrThrow`;
      query keys are unchanged.
- [x] Event drawer and Complete dialog stop sending `user_id` / `completed_by` / a computed end.
- [x] Settings: the UI follows `isGlobalSettingsTable`, so only the campus list hides Add, the row
      actions and the Active switch from an Administrator (campuses have no Settings tab).
- [x] Bystander reports page: "Showing the newest 500 reports." when the list is cut short.

### 2.3 Database / Prisma

- None.

---

## 3. Behaviour changes to review

- Administrators keep adding, editing and deleting positions, casualty conditions and damage
  conditions, as before this PR (owner decision on #103). Campuses stay Super Admin only.
- An Administrator can edit a headcount field only while no other campus links to it and no
  other campus's report or bystander report has a headcount for it. Otherwise a Super Admin
  does it, and the refusal says so (owner decision on #102).
- Creating a headcount field stays open to any Administrator.
- The Bystander reports list shows the newest 500, with a notice when there are more.

## 4. Verification

- [x] `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`
- [x] Tests: `settings-access.test.ts` (campus A admin with campus B row or parent; shared lists;
      campuses Super Admin only); `population-field-access.test.ts` (the headcount edit rule);
      `write-schemas.test.ts` (event, Settings and headcount write schemas refuse relation keys
      such as `users`, `reports`, `campus`, `user_id`, `completed_by`, and an Administrator payload
      cannot carry `user_type_id`).
- [ ] Manual as an Administrator and a Super Admin: Events (add for one and several campuses,
      edit, complete, delete), event details and the print report, Bystander reports (list,
      status, delete, photos), Campus page (add, edit, delete), Settings (each tab, population
      fields), dashboard.
