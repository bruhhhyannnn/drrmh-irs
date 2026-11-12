---
type: module
updated: 2026-11-12
module: dashboard
paths:
  - src/actions/dashboard/index.ts
  - src/components/hooks/use-dashboard.ts
  - src/app/(admin)/dashboard/page.tsx
tags: [module]
---

# Dashboard

`/dashboard` is the landing page for Administrators and Super Admins after sign-in. It shows ongoing events with cluster progress, the next upcoming event, record counts, reports by cluster, events by status and a this-month calendar. It follows the top-bar campus switcher. The Building safety section on the same page is its own module ([[building-safety]]).

**Related:** [[architecture]] · [[events]] · [[field-reports]] · [[bystander-reports]] · [[users]] · [[campus-scoping]] · [[building-safety]] · [[auth]]

## Where it lives

| Path                                                     | What it holds                                                                                                                                       |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/actions/dashboard/index.ts`                         | `getDashboard`: one action for everything on the page except Building safety                                                                        |
| `src/components/hooks/use-dashboard.ts`                  | `useDashboard(campusId?)`                                                                                                                           |
| `src/app/(admin)/dashboard/page.tsx`                     | Page and its sections: greeting, `NeedsAttention`, `CampusesStrip` (`_components/`), `StatTiles`, `ReportsByCluster`, `EventsByStatus`, `MonthCard` |
| `src/app/(admin)/dashboard/_components/building-safety/` | Not this module, see [[building-safety]]                                                                                                            |

## Data

Read only. No writes.

- `Event` (`events`) with `EventStatus` and `campus`: all events in scope, sorted by `started_at` ascending.
- `Report` (`reports`): total count, `groupBy cluster_id` for the top 8 clusters, and the reports of ongoing events with casualty and missing person counts.
- `User` (`users`): count in scope.
- `bystander_reports`: count with no status or status `pending`.
- `Cluster` (`clusters`): names for the top clusters, and active clusters per campus for "clusters reported".

## Server actions

`src/actions/dashboard/index.ts`:

- `getDashboard(campusId, monthStart, monthEnd)`: returns
  - `counts`: events, reports, users, pending bystander reports, `reportsThisWeek` (submitted in the last 7 days), `incompleteProfiles` (users with `is_profile_complete` false), and ongoing / upcoming / completed event counts.
  - `attention` (DRRM-038): `oldestPendingAt` (the oldest pending bystander report's `submitted_at`), `followUpBuildings` (active buildings whose latest assessment has `needs_follow_up`), `campusesWithoutFields` (campuses with no active population field; 0 when one campus is in scope).
  - `ongoing`: one card per ongoing event with clusters reported vs active clusters at that campus, report count, casualties, missing.
  - `nextEvent`: the next upcoming event, grouped with same-name, same-start events at other campuses.
  - `clusters`: top 8 clusters by report count, across all events.
  - `month`: events whose `started_at` falls in the month window.

No auth or role check. The campus filter is whatever the client passes: events and users by `campus_id`, reports and bystander reports through their cluster's `campus_id`.

## Client side

- Route: `/dashboard`.
- `useDashboard(campusId)` uses query key `['dashboard', campusId, 'yyyy-MM']` and refetches every 60 s. The month window is computed in the browser (`startOfMonth` / `endOfMonth`) so "this month" follows the admin's time zone.
- `campusId` comes from `useScopedCampusId()`: the Administrator's own campus, or the Super Admin's pick ('' for All campuses, sent as `undefined`).
- Heading (DRRM-038): "Good morning / afternoon / evening, {first name}" by the admin's clock, then the campus scope and today's date.
- `NeedsAttention`: a card of links, each only when non-zero, two columns on web: N bystander reports to review ("Oldest sent X ago") → `/emergency-reports`; each ongoing event ("… is live", "N of M clusters reported · started 9:00 AM") → the event; N buildings need structural follow-up → `/assessments?filter=follow-up`; N campuses have no population fields yet (Super Admins) → `/campus`. With nothing to list it says so.
- `CampusesStrip`: the campuses with events as compact `CampusCard`s (latest event and quick exports; [[campus-scoping]]), most events first: two columns on web, a sideways scroll on phone. One campus in scope (an Administrator's, or the switcher's pick) gets its full card, full width. All campuses links to `/campus` for Super Admins.
- Stat tiles link to `/events`, `/reports`, `/users` and `/emergency-reports`, with sub-lines: ongoing · upcoming, +N this week, N profiles incomplete, need review.
- The Ongoing now section (ongoing cards, next event, Add event) was replaced by Needs attention and the campuses in DRRM-038; `nextEvent` is still returned.
- `MonthCard` is the event calendar: a month grid with a dot per day that has an event (colour by status) and a list linking to `/events/details?id=`.
- Many mutations elsewhere invalidate the `dashboard` key (events, reports, bystander status changes), so the page stays fresh after edits.

## Rules and gotchas

- "Clusters reported" counts only active clusters of the event's own campus. Reports from inactive clusters still add to the report, casualty and missing totals.
- Reports by cluster covers all events, not only ongoing ones.
- `nextEvent` prefers an upcoming event whose start is in the future, then any upcoming event with a start, then the first upcoming event.
- Status names are matched in lower case (`ongoing`, `upcoming`, `completed`). Other status names are left out of the status counts.
- The month list includes only events with a `started_at`; events without a start time never appear on the calendar.
- Building safety has its own actions (`src/actions/building-safety`) and URL params (`bs_*`). Do not fold it into `getDashboard`.
- Do not add a per-page campus filter here. Use the switcher scope.

## Decisions

- [[0001-server-actions-only]]: one server action builds the whole page.
- [[0008-hand-built-charts]]: the bars and calendar are plain markup, no chart library.
