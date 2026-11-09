---
type: feature
ticket: DRRM-027
status: done
branch: feat/DRRM-027-pillar-page-redesign
modules:
  - '[[pillars-and-landing]]'
  - '[[building-safety]]'
tags: [plan, feature]
---

# [DRRM-027] Pillar page redesign: Design

- **Status:** `[Done]` (merged in PR #96, 2026-11-08)
- **Target Branch / PR:** `feat/DRRM-027-pillar-page-redesign`, stacked on `feat/DRRM-026-off-campus-accounts` (PR #95)
- **Owner / Author:** Jomar Lazaro

The design. The implementation plan follows once it's approved.

---

## 1. Problem Statement & Motivation

The pillar pages (`/pillars/<slug>`, DRRM-025) put Campus and Off-campus side by side in two narrow columns. The page is long and hard to scan. The most-failed items are squeezed into boxes that wrap every word, and the two-bar chart repeats the two numbers above it.

Admins open a pillar page to decide what to do. The page should answer, in order:

1. How are we doing?
2. What should we fix first?
3. Which buildings need a visit?
4. Where is it weakest?

It should then add the trends that show whether things are improving.

## 2. What the user decided

1. **Layout** (approved on the mockup), top to bottom:
   - a **Campus · N buildings | Off-campus · N** switch and a campus picker
   - **1. How are we doing?** (tiles)
   - **2. What to fix first** (full width; tap an item to see the buildings that fail it)
   - **3. Buildings to visit**
   - **4. Where it's weakest** (table)
   - folded: **5. By checklist section** and **Does the checklist fit?** (most-often N/A)
   - The two-bar Campus/Off-campus chart goes.
2. **All five charts** from the mockup:
   - **A. Score over time:** quarterly, a line each for Campus and Off-campus.
   - **B. Buildings by score band:** tap a band to list its buildings.
   - **C. Better, same or worse:** counts of re-assessed buildings.
   - **D. Section scores as bars,** lowest first.
   - **E. Assessments per month,** with the count of buildings not assessed in over 12 months.

## 3. Goals, non-goals, anti-goals

**Goals:** the layout and charts above, for Campus and Off-campus, on each scored pillar page, using the same scope rules as today (`requireAdmin`; Administrators see their own campus; buildings with no campus only on All campuses).

**Non-goals:**

- The `/pillars` overview page beyond keeping it working.
- The dashboard's Building safety section.
- New data collection: everything comes from existing assessments.

**Anti-goals:**

- A chart that hides its numbers: every value is printed or in a table, as `0008-hand-built-charts` requires.
- Off-campus numbers blending into campus ones.
- A chart library: charts stay hand-built in `src/app/(admin)/_components/charts`.

## 4. Design

### Page structure

`src/app/(pillars)/pillars/[pillar]/_components/pillar-metrics.tsx` is rebuilt as the sections above. The Campus/Off-campus switch is local state, kept in `?view=` so it survives a reload. Each section is its own small component in that folder.

**Campus picker:**

- A Super Admin gets a select of All campuses plus each campus. It writes `useCampusScopeStore`, so it stays in step with the dashboard's switcher.
- An Administrator sees their campus name as text.

### Tiles (1)

| Tile               | What it shows                                                                           |
| ------------------ | --------------------------------------------------------------------------------------- |
| Pillar score       | The pooled score, with its change since each re-assessed building's previous assessment |
| Buildings assessed | With how many were re-assessed                                                          |
| Need follow-up     | Latest assessments with `needs_follow_up`                                               |
| Answered N/A       | The N/A share of all answers                                                            |

### What to fix first (2)

The pillar's most-failed items across the full width, each with a bar for "unsafe in X of Y buildings". Tapping an item opens the list of buildings whose latest assessment failed it, each linking to that building.

### Buildings to visit (3) and where it's weakest (4)

- **Buildings to visit (3):** the lowest-scoring buildings, as today, plus a score bar, the date assessed and a Follow-up tag.
- **Where it's weakest (4):** campuses (on All campuses), clusters (on one campus) or top-level locations (off campus), with assessed count, score and change.

### Charts

| Chart                        | Computation (pure, in `src/lib/pillar-metrics.ts`)                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Score over time**       | For each of the last 8 quarters, each building's latest assessment up to the quarter's end, pooled for this pillar. Quarters before any assessment are left out. One line for Campus and one for Off-campus, each from its own buildings. |
| **B. Score bands**           | Latest assessment's pillar score in four groups: below 50%, 50–69%, 70–84% and 85%+. A building with nothing counted in the pillar goes to "No score", shown as a note. Tapping a band lists its buildings.                               |
| **C. Better, same or worse** | Re-assessed buildings: latest vs previous pillar percent, rounded. Equal is "same".                                                                                                                                                       |
| **D. Section bars**          | The existing `sectionScores` for this pillar, lowest first.                                                                                                                                                                               |
| **E. Activity**              | Assessments ended in each of the last 12 months, plus the count of active buildings whose latest assessment is more than 365 days old. Campus buildings never assessed count separately as "not yet assessed".                            |

### Data

- `getPillarMetrics` also returns:
  - each group's assessment history (`ended_at`, building, this pillar's tally) for A and E
  - which buildings failed each most-failed item, with the latest assessment id → building map
- No database change. History loads only for buildings in scope.

### Charts in code

- **Hand-built SVG** in `src/app/(admin)/_components/charts`. A reuses `LineChart` with two series. B, C and E get small new components.
- **Every value is printed:** each chart has a caption and an accessible table or list.
- **Colors** follow the existing `--series-*` tokens: Campus is series 1 and Off-campus series 2, as on the dashboard.
- **Score bands** use one maroon ramp from light to dark, since they're one scale.
- **Better/worse** uses a two-hue diverging pair with gray in the middle, and is labelled with words, never color alone.
- **Hover:** the bars and points get a hover tooltip.

### Recovery pillar

It keeps counts (in place, missing, N/A) and gets:

- **A** as the share of buildings with a plan
- **B** replaced by those three counts
- **C** as gained, kept or lost a plan
- **E**

D and the fix-first list don't apply, because Recovery has a single item.

## 5. Constraints

- CLAUDE.md core rules: server actions only, the `requireAdmin` scope, theme tokens, no `dark:` variants.
- The charts follow decision 0008 and the dataviz skill. A new categorical palette is checked with its validator.
- Scores keep pooling the same way as on the dashboard (tallies, not averages of percents).

## 6. Left to the builder, or decided by me (check these)

1. **My call:** the score bands are below 50%, 50–69%, 70–84% and 85%+.
2. **My call:** overdue means more than 365 days since the latest assessment.
3. **My call:** the trend is quarterly, the last 8 quarters; activity is monthly, the last 12 months.
4. **My call:** "Need follow-up" uses the checklist's existing follow-up flag, not a score cutoff.
5. **Builder:** component names and file split, and the chart dimensions.

---

## 7. Implementation Tasks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the pillar page as one view at a time (Campus | Off-campus): tiles, what to fix first (with failing buildings), buildings to visit, places, and charts A–E.

**Architecture:** Pure trend functions in `src/lib/pillar-trends.ts` (tested), more fields on `getPillarMetrics`, small hand-built SVG chart components, and the page split into focused components.

**Tech Stack:** Next.js server actions, Prisma, TanStack Query, hand-built SVG, `node:test` via `tsx`.

**Spec:** sections 1 to 6 of this file.

### Global Constraints

- Every chart prints its values and has an accessible table or list; colors use `--series-*`, a maroon ramp for the score bands, and a two-hue diverging pair with gray in the middle for better/worse (labelled in words).
- Dates are grouped in Philippine time (UTC+8): an assessment ending 2026-03-31T20:00Z is in Q2 2026 and April 2026.
- Score bands are exactly: below 50%, 50–69%, 70–84%, 85%+. Overdue is more than 365 days. The trend covers 8 quarters and activity 12 months.
- Scores pool tallies (`percent` of summed tallies), as on the dashboard.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Review Focus

1. A view with no assessed buildings (a new off-campus pilot) shows a plain empty note for every chart, not a broken chart. Task 4 renders the empty states, and Task 1 tests the empty inputs.
2. A building that counted nothing in the pillar (all N/A) is "No score", not "below 50%". Task 1 test.
3. Quarter and month edges in Philippine time. Task 1 test.
4. An Administrator never gets the campus picker, and the off-campus view never shows buildings with no campus outside All campuses. Task 2 keeps `requireAdmin` scoping. Task 4 shows the picker to Super Admins only.
5. Recovery has no bands or fix-first list, and its "better/same/worse" reads as gained, kept or lost a plan. Task 1 test, Task 4 labels.

### Task 1: Trend and band functions

**Files:** Create `src/lib/pillar-trends.ts` and `src/lib/pillar-trends.test.ts`.

**Produces:**

- `HistoryRow { building_id: string; ended_at: string; tally: Tally }`
- `scoreBands(buildings: BuildingScores[], pillar): { bands: { band: Band; label: string; buildings: Named[] }[]; noScore: number }`, where `Band = 'below_50' | 'from_50' | 'from_70' | 'from_85'`
- `changeCounts(buildings, pillar): { worse: Named[]; same: Named[]; better: Named[] }`
- `quarterlyTrend(history: HistoryRow[], now: Date, quarters = 8): { label: string; tally: Tally | null }[]`
- `monthlyActivity(history, now, months = 12): { label: string; count: number }[]`
- `overdueBuildings(buildings, now, days = 365): Named[]`
- `failingBuildings(facts: AnswerFact[], currentIds: string[], buildingOf: Map<string, Named & { label: string; category: BuildingCategory }>, pillar): Record<string, (Named & { label: string; category: BuildingCategory })[]>`, keyed by item label

- [x] Failing tests:
  - 49, 50, 69, 70, 84 and 85 percent land in the right bands, and an all-N/A building counts as `noScore`
  - `changeCounts` sorts by rounded percent, and equal is `same`
  - `quarterlyTrend` pools each building's latest assessment as of each quarter's end, drops leading quarters with no data, and labels quarters `Q2 2026`
  - the UTC+8 edge from the Global Constraints
  - `monthlyActivity` counts per month and labels them `Apr`
  - `overdueBuildings` leaves out never-assessed buildings and includes one assessed 366 days ago
  - `failingBuildings` lists only the latest assessments' unsafe answers, for this pillar
  - empty inputs give empty or zeroed results
- [x] Implement, run `npx tsx --test src/lib/pillar-trends.test.ts` (Expected: PASS), commit.

### Task 2: Data from the server

**Files:** Modify `src/lib/pillar-metrics.ts` (types), `src/lib/assessment-records.ts`, `src/actions/pillars/index.ts`.

**Consumes:** Task 1. **Produces:**

- `loadPillarHistory(where: Prisma.BuildingWhereInput, pillar: PillarCode): Promise<HistoryRow[]>`
- `PillarGroup` gains `needsFollowUp: number`, `bands`, `changes`, `trend`, `activity`, `overdue: Named[]`, `notYetAssessed: number` and `failing`
- `RecoveryGroup` gains `trend`, `activity`, `overdue`, `notYetAssessed` and `changes`, the last read as gained, kept or lost a plan

- [x] Implement `getPillarMetrics` filling these, with history scoped exactly like each group's buildings. Run `npm run type-check` and `npm run test` (Expected: clean, all pass). Commit.

### Task 3: Chart components

**Files:** Create `src/app/(admin)/_components/charts/band-bars.tsx`, `change-bar.tsx` and `activity-bars.tsx`. Reuse `line-chart.tsx` for the trend.

**Produces:**

- `BandBars({ bands, onSelect })`
- `ChangeBar({ worse, same, better, words: { worse; same; better } })`
- `ActivityBars({ months, overdue })`

Each component prints its values and gives every mark a hover title.

- [x] Implement them and check them with the dataviz anti-patterns list. Run `npm run type-check` (Expected: clean). Commit.

### Task 4: The page

**Files:** Rebuild `src/app/(pillars)/pillars/[pillar]/_components/pillar-metrics.tsx`, split into components in that folder (a view switch in `?view=`, campus picker, tiles, fix-first list with drill-down, buildings, places, charts, folded sections, Recovery view). Modify `src/components/hooks/use-pillars.ts` if the key changes.

**Consumes:** Tasks 2 and 3.

- [x] Build the layout from section 2 in the approved order:
  - the Super-Admin-only campus picker, writing `useCampusScopeStore`
  - an empty note per section when nothing is assessed
  - the "No score" note under the bands
- [x] Run `npm run type-check`, `npm run lint` and `npm run build` (Expected: clean). Commit.

### Task 5: Docs

- [x] Update `docs/modules/pillars-and-landing.md` and `docs/changelog.md`, and set this plan to in-review. Run `npm run test` (Expected: all pass). Commit.
