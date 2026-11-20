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
      (capped at 500, newest first), pending count, status (runtime allowlist), delete (now also
      removes the photos from Storage), signed photo URLs and mark-seen check the caller and scope.
- [x] `src/actions/campus-table`: overviews for admins in scope; `createCampus`, `updateCampus`,
      `deleteCampus` for Super Admins with `campusSchema.strict()`. Names, logos and a campus's
      clusters stay public.
- [x] `src/actions/population-categories`: writes for admins in scope, strict allowlists; the code
      is fixed once made; an Administrator may edit only a field no other campus uses;
      `addCampusPopulationCategory` locks the campus row while picking the next place (#108 item 3
      for this action); a reorder must name links of one campus in scope (at most 100). Reads stay
      public.
- [x] `src/actions/dashboard`: `getDashboard(token, …)`, campus from the scope; returns `ok: true`.
- [x] `src/actions/settings`: `getSettingsItems` for admins, scoped to the Administrator's campus
      for clusters, units and buildings. Writes parse the table's strict schema and go through
      `canWriteSetting` (`src/lib/settings-access.ts`): positions, conditions and campuses are
      Super Admin only; clusters, units and buildings need both the saved row's campus and the new
      parent's campus in scope. Names lose control characters (#111).
- [x] `src/lib/utils.ts`: `ActionRefusal`, `okOrThrow` (hooks throw the refusal in the browser).

### 2.2 Frontend / Components

- [x] Hooks (`use-events`, `use-bystander-reports`, `use-campus`, `use-population-categories`,
      `use-dashboard`, `use-settings`) pass `await getAccessToken()` and unwrap with `okOrThrow`;
      query keys are unchanged.
- [x] Event drawer and Complete dialog stop sending `user_id` / `completed_by` / a computed end.
- [x] Settings: on the shared lists an Administrator gets no Add button, row actions or Active
      switch.

### 2.3 Database / Prisma

- None.

---

## 3. Behaviour changes to review

- Administrators can no longer add, edit or delete positions, casualty conditions or damage
  conditions (they still can through "Other (please specify)" on a profile, which adds a
  position). #103 asked for this; say if Administrators should keep editing them.
- An Administrator can edit a headcount field's name only when no other campus uses it.
- The Bystander reports list shows the newest 500.

## 4. Verification

- [x] `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`
- [x] Tests: `settings-access.test.ts` (campus A admin with campus B row or parent; shared lists).
- [ ] Manual as an Administrator and a Super Admin: Events (add for one and several campuses,
      edit, complete, delete), event details and the print report, Bystander reports (list,
      status, delete, photos), Campus page (add, edit, delete), Settings (each tab, population
      fields), dashboard.
