---
type: feature
ticket: DRRM-010
status: in-review
branch: feat/DRRM-010-ert-report-v2
modules:
  - '[[field-reports]]'
  - '[[offline-pwa]]'
  - '[[design-system]]'
tags: [plan, feature]
---

# [DRRM-010] Feature Plan: ERT Report v2

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-010-ert-report-v2`
- **Owner / Author:** Bryan Mangapit
- **Design source:** Claude Design project → `DRRM-H Redesign - ERT.dc.html` (screens 6–10: 6, 6a–6e, 7, 7a, 8 + 9, 9a, 10; web 1140 / tablet 768 / phone 390). Builds on DRRM-009 (auth pages, shared `src/components/ds`).

---

## 1. Problem Statement & Motivation

`/report` reused the admin `ReportForm` inside a glass card over a photo carousel: an intro paragraph and privacy notice above the fields, number inputs for the headcount, a dropdown for structural damage, and a separate Report Details modal after submitting. A leader filling the headcount as people arrive had to scroll between fields with no running total, a refresh lost everything, and a report saved offline was only mentioned in a toast.

The redesign keeps it one page (the counts and total stay in view together), adds a summary rail on web and a bottom bar on tablet and phone, saves a draft on the phone, and shows what happened to the report afterwards: submitted, saved offline, or waiting to send.

---

## 2. Requirements & User Stories

- **As an ERT member**, I want the event as the page title, with Change event when there is more than one.
- **As an ERT leader**, I want − / + steppers with a live total, and my draft kept if the page reloads.
- **As an ERT member**, I want to see my submitted report (totals first) and still add missing persons and casualties.
- **As an ERT member**, I want to know when a report is waiting on my phone, and send it now.

Acceptance criteria:

- [x] Solid white top bar: logo, name, account button (My profile, Sign out).
- [x] Hero: "Status report · campus", event name, Ongoing pill, Change event (drawer, ongoing events only). One ongoing event is preselected.
- [x] "Reporting as" and cluster / unit become one read-only strip marked From your profile.
- [x] Location: map with Use my location and Clear (48px), the address under it.
- [x] Headcount: steppers (48px buttons, mono numbers, typeable), 2 columns on web and tablet, 1 on phone, live total.
- [x] People affected: Add / Manage open the shared people drawer — name required and Diagnosis label for ERT.
- [x] Structural damage is required: tiles from Settings.
- [x] Web: "Before you submit" rail checks event, location and damage, shows the total, Submit and the draft time, and the privacy line. Tablet / phone: privacy line under the form and a bottom bar with the total and Submit.
- [x] Draft: saved to local storage after each change, keyed by member (with its event); restored with "Draft restored from …" and Start over (asks first); removed once the report submits or is saved offline.
- [x] No ongoing event: says so, shows the last report, View last report; the page checks for new events every 30 s.
- [x] Saved offline: "Report saved on this phone" with the event, headcount, time and status. It stays after a reload until the report sends.
- [x] Waiting to send: a chip in the top bar while a report is queued; the list shows each report and Try sending now; a green "Sent" chip for a few seconds after it goes through.
- [x] Submitted: totals (headcount, missing, casualties, damage), headcount breakdown in campus order, people with Add / Manage (saves straight to the report, "Save changes"), details. Replaces the Report Details modal.
- [x] Light theme, Figtree + Spline Sans Mono, no horizontal scroll from 320px up.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

No schema changes. Missing person / casualty `age` was already nullable in the DB; `missingPersonSchema` and `casualtySchema` now allow `null`, so a blank age shows as unknown instead of "0 yrs".

### Server Actions & Data Flow

- `getMyLatestReport(userId)` (`src/actions/reports`) + `useMyLatestReport`: the member's most recent report on any event.
- `useOngoingEvents` takes `refetchInterval` and skips the query without a campus id.
- Offline queue (`src/lib/offline-queue.ts`): entries can carry a `summary` (title / subtitle) for the waiting list. `useOfflineQueueStore` gains `flushNow`, `lastAttemptAt` and `lastFieldSyncAt`, set by `OfflineQueueProvider`, which also refreshes `my-report` / `my-latest-report` after a field report syncs.
- New reports still go through `createReport` in one payload (casualties, missing persons and counts bundled), queued with `queueFieldReport` when offline or on a network-shaped failure.

### UI & User Interaction

- `src/app/(ert)/report/page.tsx`: picks the screen — profile setup, submitted report, saved offline, offline first load, no ongoing event (or a past report), or the form.
- `_components/`: `frame` + `top-bar` (account menu, `waiting-to-send` chip and drawer), `chrome` (hero, pills, cards, numbered sections, detail lists), `report-form`, `location-section`, `event-drawer`, `people-rows`, `submitted-report`, `notice-screens`.
- `_lib/`: `draft` (local storage), `format` (dates), `use-field-queue`.
- `src/components/ds`: `PeopleDrawer` and `PrivacyDrawer` moved here from the bystander form (with an `audience` option), plus `Banner`, people summaries and `formatCoordinates`.
- The admin `ReportForm` (`/reports`) is unchanged apart from accepting a null age.

---

## 4. Implementation Tasks

- [x] Task 1: Share the people / privacy drawers.
- [x] Task 2: Data layer (latest report, polling, queue summaries, flush now, nullable ages).
- [x] Task 3: Form, drawers, rail / bottom bar, draft.
- [x] Task 4: Submitted, no ongoing event, saved offline, waiting to send, account menu.
- [x] Task 5: Responsive check at 1140 / 768 / 390 / 320.

---

## 5. Verification & Rollout Plan

- [x] `npm run lint`: no new findings (one pre-existing warning in `users/user-form.tsx`).
- [x] `npm run type-check`: clean.
- [x] `npm run build`: passes; `/report` prerenders as static.
- [x] Headless Chrome walk-through at 1140 / 768 / 390 / 320 through a temporary preview route (the dev DB has no ongoing event and the walk-through must not write data): form with one and two events, no ongoing event, saved offline, submitted (a real report, read only). Interactions: steppers and damage tiles update the rail and total; the people drawer refuses a blank name; reload restores the draft; Start over clears it; Submit with no event opens the event drawer; account menu; a queued report shows the chip and list (its send was blocked in the browser). No horizontal overflow.
- [ ] Not run: a real submit, saving people on a submitted report, and a real offline round trip — they need an ongoing event in the DB.

Deviations from the design:

- **Appearance (Light / Dark / Auto) is not in the account menu.** The ERT pages are light only, like the other redesigned pages, so the control would change nothing a member sees. Add it once there are dark tokens.
- Use my location sits bottom-left on the map: bottom-right covers the map's OpenStreetMap attribution. (The bystander map has the same overlap — open item.)
- Damage tiles are 4 columns on tablet and web instead of 5, because the Settings values are long (e.g. "Unsafe for occupancy — needs inspection").
- Change event shows only when there is more than one ongoing event (with one, it is preselected and there is nothing to change).
- The "Other (please specify)" damage option is gone; values come from Settings only.
- The waiting list says "Keep this app installed, and don't clear its data, until this list is empty" instead of "Stay signed in": signing out doesn't clear the queue, and it replays without a session.
- Added: an offline banner on the form, an offline first-load notice, and a "Couldn't send" state for queued reports the server rejected.

Open items:

- [ ] The queued report replays through `createReport` without a server-side auth check (true across `src/actions`, see DRRM-008).
- [ ] Saving people on a submitted report deletes and re-creates the rows in separate calls (see DRRM-003).
- [ ] Damage tile order follows Settings (alphabetical); "No visible damage" may belong first.
