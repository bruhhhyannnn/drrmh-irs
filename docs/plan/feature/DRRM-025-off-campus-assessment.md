---
type: feature
ticket: DRRM-025
status: in-review
branch: feat/DRRM-025-off-campus-assessment
modules:
  - '[[assessments]]'
  - '[[assessment-admin]]'
  - '[[building-safety]]'
  - '[[pillars-and-landing]]'
  - '[[offline-pwa]]'
  - '[[database]]'
tags: [plan, feature]
---

# [DRRM-025] Off-campus building assessments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** `In Review`
- **Target Branch / PR:** `feat/DRRM-025-off-campus-assessment`
- **Owner / Author:** Jomar Lazaro

**Goal:** Let ERT members assess buildings outside UP by location (Region → Province → City/Municipality → Barangay → Building), and let admins read those results apart from campus results on the dashboard and the pillar pages.

**Architecture:** A building is either Campus (has a unit, as today) or Off-campus (no unit; has a barangay and an owning campus). The location list is the PSA's PSGC, shipped as a JSON file and saved on the phone so it works offline. Scoring doesn't change; only the grouping does, and off-campus buildings never count toward a campus score.

**Tech Stack:** Next.js server actions, Prisma with idempotent manual SQL, TanStack Query, IndexedDB (`assessment-cache`), `node:test` through `tsx`.

**Spec:** sections 1 to 3 of this file.

## Global Constraints

- Never run `prisma db push`, `prisma migrate dev` or `prisma migrate reset`. Schema changes ship as `prisma/manual/DRRM-025-off-campus-buildings.sql` plus the `schema.prisma` edit.
- Read the relevant guide in `node_modules/next/dist/docs/` before writing page or routing code.
- Every read and write is a `'use server'` action that verifies the token with `requireProfile` / `requireAdmin`. Expected failures return `{ ok: false, error, retry }`.
- The whole assessment stays one `createAssessment` payload, because the offline queue replays it.
- Theme tokens only (`bg-canvas`, `bg-surface`, `border-line`, `bg-brand-solid`), no `dark:` variants.
- Only a building with a unit counts toward a campus or All campuses number.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A phone with an older draft or a queued assessment when this deploys.** It must still submit as a campus assessment. Pinned in Task 3.
2. **A place with no province** (Metro Manila, independent cities such as Baguio). The evaluator can still reach its barangays. Pinned in Tasks 1 and 4.
3. **A phone that goes offline before the location list has downloaded.** Off-campus explains what to do and on-campus keeps working. Pinned in Task 4.
4. **An off-campus building being saved.** The campus and All campuses numbers stay exactly as they were. Pinned in Task 2, with a before-and-after check in section 5.
5. **The same new building submitted twice with different capitals or spaces, or from two phones.** One building results, so its history isn't split. Pinned in Task 3.

---

## 1. Problem Statement & Motivation

The system will be pilot-tested outside UP campuses, and this plan covers the ERT Assessment tool. Today the Details step only offers Campus, Cluster, Unit and Building, which don't describe a building at a pilot site. Testers use existing UP accounts.

---

## 2. Requirements & User Stories

- **As an ERT Member**, I want to choose On campus or Off campus and then find the building by its official location, so that I can assess a building outside UP, even offline.
- **As an Administrator**, I want to see off-campus results from my campus's ERT members without them changing my campus scores.
- **As a Super Admin**, I want to compare Campus and Off-campus for each DRRM pillar, including whether the checklist suits off-campus buildings.

Acceptance criteria:

- [ ] The Details step has a required On campus / Off campus choice with nothing pre-selected.
- [ ] Off campus shows Region, Province (hidden or skippable when there is none), City/Municipality, Barangay and Building.
- [ ] A new off-campus building can carry an optional map pin, as in the Report tool.
- [ ] Existing buildings and their history are unchanged and count as Campus.
- [ ] Dashboard Building safety has a Campuses | Off-campus switch, and Off-campus drills down by location.
- [ ] Campus and All campuses numbers exclude off-campus buildings.
- [ ] Each pillar page shows the section 3 metrics, split by Campus and Off-campus.
- [ ] `/pillars` shows an overview of all four pillars.

### Decisions made for this plan, still to be confirmed

1. Both categories stay: UP buildings keep Cluster and Unit.
2. An Administrator sees off-campus buildings owned by their own campus, and a Super Admin sees all of them.
3. The pillar pages get these metrics inside this system, even though `src/lib/pillars.ts:9` planned separate apps. `pillarHref` still allows moving them later.
4. Off-campus buildings show a plain count of assessed buildings, not "x of y", because a building is added at the moment it's assessed.
5. The pin doesn't fill in the dropdowns in this version. OpenStreetMap addresses don't split cleanly into PSGC levels.

### Non-goals

- Incident reports outside campus. `reports.cluster_id` stays required, so reports stay out of the pillar comparison.
- Accounts or organizations for non-UP users.
- Sharing one off-campus building between campuses. Two campuses assessing the same site create two buildings.
- Editing off-campus buildings in Settings.
- Location filters on the admin Assessments tabs. Those tabs get a category filter, and the dashboard has the drill-down.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

`buildings` changes. Existing rows aren't touched.

| Column                                                                                   | Campus building | Off-campus building                    |
| ---------------------------------------------------------------------------------------- | --------------- | -------------------------------------- |
| `unit_id` (now nullable)                                                                 | set             | null                                   |
| `campus_id` (new, owning campus)                                                         | null            | set                                    |
| `region_code`, `region_name`, `city_code`, `city_name`, `barangay_code`, `barangay_name` | null            | set                                    |
| `province_code`, `province_name`                                                         | null            | set, or null when there is no province |
| `latitude`, `longitude`, `location_name`                                                 | null            | optional pin                           |

- `chk_buildings_place` allows exactly one of the two shapes.
- `uq_buildings_campus_barangay_name` is unique on `(campus_id, barangay_code, lower(name))` where `unit_id IS NULL`.
- Names are stored with the codes so the dashboard can group without loading the location list, and a later PSGC rename doesn't change past records.

### Location data

PSGC comes from the PSA's publication spreadsheet (psa.gov.ph/classification/psgc). A one-off script turns it into `src/data/psgc.json`, which the server reads to validate a barangay code and the phone saves in `assessment-cache`. The payload carries only `barangay_code`; the server derives the other levels and names from its own copy.

### Dashboard and pillar metrics

Every existing formula stays. Off-campus adds grouping by location, skips any level with one child, and hides "x of y" and "Not yet assessed".

| Pillar page metric    | Prevention, Preparedness, Response  | Recovery                        |
| --------------------- | ----------------------------------- | ------------------------------- |
| Main number           | Pillar score and points change      | In place / Missing / N/A counts |
| Campus vs Off-campus  | Score with building counts          | Counts per category             |
| By campus or location | Scores                              | Counts                          |
| Buildings             | 5 lowest-scoring                    | Those with the plan missing     |
| Sections and items    | Section scores, 5 most-failed items | None (one item)                 |
| Checklist fit         | N/A rate and 5 most-often N/A items | N/A count                       |

N/A rate is `na / (counted + na)`.

---

## 4. Implementation Tasks

### Phase 1: Data and capture

### Task 1: PSGC location data

**Files:**

- Create: `scripts/build-psgc.ts`, `src/lib/psgc.ts`, `src/lib/psgc-data.ts`, `src/data/psgc.json`
- Test: `src/lib/psgc.test.ts`, `src/lib/psgc-data.test.ts`
- Modify: `package.json` (`exceljs` as a dev dependency, script `psgc:build`)

**Interfaces:**

- Produces in `src/lib/psgc.ts` (no data import, safe in the browser):
  - `PSGC_VERSION: string`, the PSA release, for example `'2026-Q3'`
  - `CodeName { code: string; name: string }`
  - `PsgcCity extends CodeName { barangays: CodeName[] }`
  - `PsgcProvince extends CodeName { cities: PsgcCity[] }`
  - `PsgcRegion extends CodeName { provinces: PsgcProvince[]; cities: PsgcCity[] }`, where `cities` holds those with no province
  - `PsgcTree = PsgcRegion[]`
  - `BuildingLocation { region: CodeName; province: CodeName | null; city: CodeName; barangay: CodeName }`
  - `parsePsgcRows(rows: { code: string | number; name: string; level: string }[]): PsgcTree`
  - `indexBarangays(tree: PsgcTree): Map<string, BuildingLocation>`
- Produces in `src/lib/psgc-data.ts` (import only from server code): `loadPsgcTree(): Promise<PsgcTree>`, `findBarangay(code: string): Promise<BuildingLocation | null>`

- [ ] **Step 1: Open the PSA spreadsheet and confirm its layout.** The parser assumes a sheet with columns `10-digit PSGC`, `Name`, `Geographic Level`, and levels `Reg`, `Prov`, `Dist`, `City`, `Mun`, `SubMun`, `SGU`, `Bgy`. This comes from memory of past releases, so correct the parser and tests if the file differs.

- [ ] **Step 2: Write the failing tests in `src/lib/psgc.test.ts`**

```ts
test('a municipality in a province holds its barangays');
// Prov 0102800000, Mun 0102801000, Bgy 0102801001 → regions[0].provinces[0].cities[0].barangays[0]

test('a city with no Prov row sits directly under the region');
// Baguio-style: City 1430300000 with no Prov 14303… → region.cities[0], region.provinces is []

test('barangays under a SubMun belong to the city');
// City 1380600000, SubMun 1380601000, Bgy 1380601001 → city.barangays has the Bgy; no SubMun node

test('codes keep their leading zero when the sheet gives numbers');
// { code: 102801001, level: 'Bgy' } → '0102801001'

test('a barangay with no city throws');
// assert.throws naming the barangay's code

test('indexBarangays gives province null when there is none');
```

- [ ] **Step 3: Run them to verify they fail.** Run: `npx tsx --test src/lib/psgc.test.ts`. Expected: FAIL, the module doesn't exist.

- [ ] **Step 4: Implement `parsePsgcRows`.** Walk rows in file order, tracking the current region and city. `City`, `Mun` and `SGU` start a city, placed under the `Prov` row sharing its first 5 digits, otherwise directly under the region. `Dist` and `SubMun` add no node. Pad codes to 10 digits.

- [ ] **Step 5: Run the tests to verify they pass.** Expected: PASS.

- [ ] **Step 6: Add `scripts/build-psgc.ts <path-to-xlsx>` and generate the data.** Run: `npm run psgc:build -- <file>`. Expected: it prints region and barangay counts and writes `src/data/psgc.json`.

- [ ] **Step 7: Write `src/lib/psgc-data.test.ts` and implement `psgc-data.ts`.** Assert that there are at least 17 regions, more than 41,000 barangays, all codes are 10 digits and unique, and `findBarangay` returns null for `'0000000000'`. Use a dynamic JSON import and cache the index in the module.

- [ ] **Step 8: Check the download size.** Report the gzipped size of `src/data/psgc.json`. Expected: under 600 KB; if not, shorten the JSON keys before continuing.

- [ ] **Step 9: Commit.** `feat(assessments): add the PSGC location list (DRRM-025)`

### Task 2: Schema and reads that accept both categories

Campus pages must look identical after this task.

**Files:**

- Create: `prisma/manual/DRRM-025-off-campus-buildings.sql`, `src/lib/building-place.ts`
- Test: `src/lib/building-place.test.ts`
- Modify: `prisma/schema.prisma:509-525`, `src/lib/assessment-template.ts:119-127,143-173,194-214`, `src/lib/assessment-records.ts:207-238,293-323`, `src/actions/assessment-admin/index.ts:31-32,51-75`, `src/actions/building-safety/index.ts:50-57,142-171,199-209`, `src/actions/assessments/index.ts:82-93,140-143,304-311`, `src/actions/settings/index.ts:72-80`
- Modify (UI, as `tsc` lists them): `src/app/(admin)/assessments/details/page.tsx:61`, `buildings-tab.tsx`, `assessments-tab.tsx`, `compare-tab.tsx`, `dashboard/_components/building-safety/building-level.tsx:41`, `src/app/(ert)/assessment/_components/assessment-hub.tsx:394`, `assessment-view.tsx:140-141`, `assessment-print.tsx:140-141`

**Interfaces:**

- Consumes: `BuildingLocation`, `CodeName` from Task 1
- Produces in `src/lib/building-place.ts`:
  - `BuildingCategory = 'campus' | 'off_campus'`
  - `BuildingPlace { category: BuildingCategory; campus: Named; cluster: Named | null; unit: Named | null; location: BuildingLocation | null; label: string }`. `label` is the unit name, or `"<barangay>, <city>"`.
  - `buildingPlaceSelect` (a `Prisma.BuildingSelect`), `toBuildingPlace(row): BuildingPlace`
  - `buildingInCampus(campusId: string | null)`, `campusBuildings(campusId: string | null)`, `offCampusBuildings(campusId: string | null)`, each returning `Prisma.BuildingWhereInput`
- Produces type changes:
  - `BuildingScores`, `AdminAssessmentRow`: `unit` and `cluster` become `Named | null`; they add `category`, `location`, `label`
  - `AssessmentRecord`: `unit_name`, `cluster_name` become `string | null`; it adds `location`
  - `MyAssessmentRow`: `unit_name` is renamed `place_label`

- [ ] **Step 1: Write the idempotent SQL from section 3.** Use `ALTER … DROP NOT NULL`, `ADD COLUMN IF NOT EXISTS`, drop-and-add for `chk_buildings_place`, and `CREATE UNIQUE INDEX IF NOT EXISTS`.

- [ ] **Step 2: Edit `schema.prisma`.** Add the columns and make `unit` optional. Add the `campus` relation on `Building` with its back-relation on `campus`, and a comment naming the SQL file for the check and index. Run `npx prisma validate` and `npx prisma generate`. Expected: both succeed.

- [ ] **Step 3: Apply the SQL to the development database, after asking the user.** Use the `db execute` command in `docs/modules/database.md`, and run it twice. Expected: no error either time.

- [ ] **Step 4: Write the failing tests in `src/lib/building-place.test.ts`**

```ts
test('campusBuildings only ever matches buildings with a unit');
// assert.deepEqual(campusBuildings('c1'), { unit_id: { not: null }, unit: { cluster: { campus_id: 'c1' } } });
// assert.deepEqual(campusBuildings(null), { unit_id: { not: null } });

test('offCampusBuildings matches no unit, and the owning campus');
// assert.deepEqual(offCampusBuildings('c1'), { unit_id: null, campus_id: 'c1' });

test('buildingInCampus covers both categories');
// OR of { unit: { cluster: { campus_id: 'c1' } } } and { campus_id: 'c1' }; {} for null

test('toBuildingPlace reads a campus row');
// category 'campus', location null, label = unit name, campus from unit.cluster.campus

test('toBuildingPlace reads an off-campus row with no province');
// category 'off_campus', cluster null, province null, label 'Barangay 670, City of Manila'
```

- [ ] **Step 5: Run them to verify they fail, implement `building-place.ts`, and run them to verify they pass.** Run: `npx tsx --test src/lib/building-place.test.ts`. Use `import type` for Prisma so the test doesn't load a client.

- [ ] **Step 6: Change the types, then fix every error `npm run type-check` lists.**
  - `getSafetyRollup` uses `campusBuildings`.
  - `getAssessmentList`, `getBuildingSummaries`, the history and compare scope checks, and `resolveBuilding`'s id lookup use `buildingInCampus` and `toBuildingPlace`.
  - The Settings Buildings list adds `unit_id: { not: null }`.
  - The view and print show Region, Province, City/Municipality and Barangay rows when `location` is set, otherwise the existing Unit and Cluster rows.

- [ ] **Step 7: Verify.** Run `npm run type-check`, `npm run lint`, `npm run test`. Expected: all pass.

- [ ] **Step 8: Commit.** `feat(assessments): allow off-campus buildings in the schema and reads (DRRM-025)`

### Task 3: Draft, payload and submit

**Files:**

- Modify: `src/lib/assessment-draft.ts:23-51,64-95,327-333,350-390`, `src/lib/schemas.ts:275-282,304-316`, `src/lib/assessment-template.ts:120-127`, `src/actions/assessments/index.ts:133-175,222`, `src/app/(ert)/assessment/_components/assessment-hub.tsx:97-119`, `review-step.tsx:37-44`
- Create: `src/lib/building-match.ts`
- Test: `src/lib/assessment-draft.test.ts`, `src/lib/schemas.test.ts`, `src/lib/building-match.test.ts`

**Interfaces:**

- Consumes: `findBarangay` (Task 1), `offCampusBuildings`, `buildingInCampus` (Task 2)
- Produces:
  - `AssessmentDraft` adds `location_kind: BuildingCategory | null`, `region_code`, `province_code`, `city_code`, `barangay_code` (all strings, `''` when empty), `pin: { lat: number; lng: number; name: string | null } | null`
  - `locationKindOf(draft): BuildingCategory | null`, where a draft saved before this change (field `undefined`) is `'campus'` and a new one is `null`
  - `detailsFromDraft(draft)`: the object `assessmentDetailsSchema` parses, used by the Details and Review steps
  - The payload's `building` union adds `{ new_off_campus: { barangay_code: string; name: string; latitude: number | null; longitude: number | null; location_name: string | null } }`, with `barangay_code` matching `/^\d{10}$/`
  - `BuildingOption`: `unit_id: string | null`, plus `barangay_code: string | null`
  - `matchBuildingByName<T extends { name: string }>(rows: T[], name: string): T | null`

- [ ] **Step 1: Write the failing tests**

```ts
// assessment-draft.test.ts
test('a draft saved before off-campus existed counts as campus');
// delete draft.location_kind → locationKindOf(draft) === 'campus'
test('a new draft has no location chosen');
test('toPayload sends an off-campus building by barangay code');
// { new_off_campus: { barangay_code: '1380601001', name: 'Annex', latitude: null, longitude: null, location_name: null } }
test('draftFromPayload restores an off-campus building');
// location_kind 'off_campus', barangay_code and name restored, the pin restored when latitude is set

// schemas.test.ts
test('a queued payload from before this change still parses');
// the existing { new: { unit_id, name } } shape
test('an off-campus payload needs a 10-digit barangay code');
test('details need a location choice');
// location_kind null → an error on location_kind
test('off-campus details need a barangay, not a cluster or unit');
test('on-campus details still need a cluster and unit');

// building-match.test.ts
test('matches ignoring case and surrounding spaces');
// matchBuildingByName([{ name: 'Annex' }], ' annex ') → that row
test('no match gives null');
```

- [ ] **Step 2: Run them to verify they fail.** Run: `npx tsx --test src/lib/assessment-draft.test.ts src/lib/schemas.test.ts src/lib/building-match.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the draft fields, `toPayload`, `draftFromPayload`, the schemas and `matchBuildingByName`.** Keep `version: 1` so saved drafts still load. `newDraft` still pre-fills the profile's cluster and unit, which stay hidden until On campus is chosen.

- [ ] **Step 4: Run them to verify they pass.** Expected: PASS.

- [ ] **Step 5: Update `getAssessmentSetup` and `resolveBuilding`.** Setup returns both categories. For `new_off_campus`: call `findBarangay`, and on null fail with `"That barangay is no longer on the location list. Choose it again."`. Then match an existing building in that campus and barangay with `matchBuildingByName`, or create it with `campus_id` from the verified caller and the server-derived location. On a unique violation, match again, as the unit branch does.

- [ ] **Step 6: Update `openAsDraft` and `review-step.tsx`.** `openAsDraft` handles `new_off_campus` and an existing off-campus building. A reopened off-campus draft has its `region_code`, `province_code` and `city_code` restored from the location list. `review-step.tsx` uses `detailsFromDraft`.

- [ ] **Step 7: Verify.** Run `npm run type-check`, `npm run lint`, `npm run test`. Expected: all pass.

- [ ] **Step 8: Commit.** `feat(assessments): submit off-campus buildings (DRRM-025)`

### Task 4: Details step

**Files:**

- Create: `src/app/(ert)/assessment/_components/location-fields.tsx`, `src/lib/location-options.ts`
- Test: `src/lib/location-options.test.ts`
- Modify: `details-step.tsx`, `assessment-hub.tsx`, `src/components/ds/select.tsx`, `src/components/ds/fields.tsx:147`, `src/actions/assessments/index.ts`, `src/components/hooks/use-assessments.ts`

**Interfaces:**

- Consumes: `PsgcTree`, `PSGC_VERSION` (Task 1), the draft fields (Task 3), `LocationPicker` from `@/components/ds`
- Produces:
  - `getLocationTree(token: string | null): Promise<PsgcTree | null>`
  - `useLocationTree()`: reads `psgc:<PSGC_VERSION>` from `assessment-cache` and only calls the action when it's missing, with `staleTime: Infinity`
  - `locationOptions(tree: PsgcTree | null, picks: { region_code: string; province_code: string; city_code: string }): LocationOptions`
  - `LocationOptions { available: boolean; regions: CodeName[]; provinces: CodeName[]; showProvince: boolean; cities: CodeName[]; barangays: CodeName[] }`
  - `NO_PROVINCE = '__none'`, the Province option for cities outside any province
  - `SelectField` gains `searchable?: boolean`

- [ ] **Step 1: Write the failing tests in `src/lib/location-options.test.ts`**

```ts
test('no saved list means off-campus is unavailable');
// locationOptions(null, picks).available === false

test('a region with no provinces hides Province and lists its cities');
// showProvince false; cities = region.cities

test('a region with both adds a no-province option');
// provinces ends with { code: NO_PROVINCE, name: 'City not under a province' }

test('choosing no province lists the independent cities');
test('choosing a province lists its cities');
test('choosing a city lists its barangays');
```

- [ ] **Step 2: Run them to verify they fail, implement `locationOptions`, and run them to verify they pass.** Run: `npx tsx --test src/lib/location-options.test.ts`.

- [ ] **Step 3: Add `searchable` to `SelectField`.** It shows a filter box at the top of the open list. Use it for City/Municipality and Barangay, because Manila alone has hundreds of barangays and type-to-jump needs a physical keyboard.

- [ ] **Step 4: Add `getLocationTree` and `useLocationTree`.** Call the hook in `AssessmentHub` so the list is saved before the evaluator goes offline.

- [ ] **Step 5: Change the Details step.**
  - Start with a required On campus / Off campus choice with nothing selected. Changing it clears the building, and answers stay.
  - On campus shows the existing Campus, Cluster, Unit and Building fields.
  - Off campus shows Region, Province, City/Municipality, Barangay and Building, with buildings filtered by `barangay_code`. Under them, show `Results go to <campus name>`.
  - "Add a building…" under Off campus shows the name field and an optional `LocationPicker` without `autoLocate`.
  - When `available` is false, show `Connect to the internet once to download the location list.` On campus stays usable.

- [ ] **Step 6: Verify on a phone-sized browser.** Sign in with the ERT test account from `test-accounts.local.md`.
  - Complete an off-campus assessment online.
  - Reach a Metro Manila barangay, then an independent city's barangay.
  - Complete one with the network off in dev tools, then reconnect and confirm it sends.
  - Confirm the map failing offline doesn't block the form.

- [ ] **Step 7: Verify.** Run `npm run type-check`, `npm run lint`, `npm run test`. Expected: all pass.

- [ ] **Step 8: Commit.** `feat(assessments): choose on campus or off campus on the Details step (DRRM-025)`

### Phase 2: Admin views

### Task 5: Dashboard Campuses | Off-campus

**Files:**

- Modify: `src/lib/building-safety.ts:74-76,120-141,326-363`, `src/actions/building-safety/index.ts`, `src/components/hooks/use-assessments.ts`, `src/app/(admin)/dashboard/_components/building-safety/building-safety.tsx`, `parts.tsx`, `building-level.tsx`
- Test: `src/lib/building-safety.test.ts`

**Interfaces:**

- Consumes: `offCampusBuildings`, `BuildingScores.location` (Task 2)
- Produces:
  - `LocationScope { regionCode: string | null; provinceCode: string | null; cityCode: string | null; barangayCode: string | null }`
  - `ChildRow['kind']` adds `'region' | 'province' | 'city' | 'barangay'`
  - `openLocationLevel(buildings: BuildingScores[], scope: LocationScope): { trail: CodeName[]; children: ChildRow[] }`
  - `scopeFromParams` also returns `view: 'campus' | 'off_campus'` and `location: LocationScope`
  - `getOffCampusRollup(token, { campusId, ...LocationScope }): Promise<OffCampusRollup | null>`, where `OffCampusRollup` is `SafetyRollup` without `level` and `notAssessed`, and `trail: CodeName[]`
  - URL params `bs_view`, `bs_region`, `bs_province`, `bs_city`, `bs_barangay`

- [ ] **Step 1: Write the failing tests in `src/lib/building-safety.test.ts`**

```ts
test('starts by region when buildings span regions');
test('a level with one child opens that child, and adds it to the trail');
// one region, two cities → children are the cities, trail is [region]

test('a city with no province is a child of its region beside provinces');
// kinds are 'province' and 'city'

test('one barangay ends at its buildings');
// children all kind 'building'

test('location scores pool the same way as campus scores');
// a child's current.overall equals poolBuildings(list).current.overall

test('scopeFromParams defaults to the campus view');
```

- [ ] **Step 2: Run them to verify they fail, implement `openLocationLevel` and the `scopeFromParams` change, and run them to verify they pass.** Run: `npx tsx --test src/lib/building-safety.test.ts`.

- [ ] **Step 3: Extract `rollupDetails(buildings)` from lines 84-115 of the action, and add `getOffCampusRollup`.** It applies `requireAdmin`, then `offCampusBuildings(scope.campusId)` narrowed by the location codes. `getSafetyRollup` calls the same helper and returns the same result as before.

- [ ] **Step 4: Add the switch and the off-campus level.**
  - Add a Campuses | Off-campus switch above the section. Changing it clears the location and campus drill params, and the DEEPER map gets the new keys.
  - The off-campus level reuses `SummaryTiles`, the charts, `SectionScores` and `MostFailed`.
  - `ChildrenTable` gets `showCoverage={false}`, which shows a plain count.
  - Hide "Not yet assessed", and show `Not counted in campus scores.` in the header.
  - Building level uses the location trail when `building.location` is set.

- [ ] **Step 5: Verify.** Run `npm run type-check`, `npm run lint`, `npm run test`. Then confirm in the browser as Administrator and Super Admin that drilling, Back and the campus switcher all work.

- [ ] **Step 6: Commit.** `feat(dashboard): add the off-campus building safety view (DRRM-025)`

### Task 6: Assessments admin tabs

**Files:**

- Modify: `src/app/(admin)/assessments/_components/buildings-tab.tsx`, `assessments-tab.tsx`, `compare-tab.tsx`
- Create: `src/app/(admin)/assessments/_lib/category-filter.ts`
- Test: `src/app/(admin)/assessments/_lib/category-filter.test.ts`

**Interfaces:**

- Consumes: `category`, `label` (Task 2)
- Produces: `filterByCategory<T extends { category: BuildingCategory }>(rows: T[], category: BuildingCategory | 'all'): T[]`, `clusterOptions(rows)`, which skips rows with a null cluster

- [ ] **Step 1: Write failing tests.** `filterByCategory` returns only the requested category, and all rows for `'all'`. `clusterOptions` has no null entry when off-campus rows are present.

- [ ] **Step 2: Run them to verify they fail, implement, and run them to verify they pass.** Run: `npx tsx --test "src/app/(admin)/assessments/_lib/category-filter.test.ts"`.

- [ ] **Step 3: Add the filter to all three tabs.** Add a filter with All, Campus and Off-campus, defaulting to Campus so the pages open as they do today, and keep it in `?category=`. Cluster and Unit filters are disabled on Off-campus. Show `label` as the secondary line.

- [ ] **Step 4: Verify and commit.** Run `npm run type-check`, `npm run lint`, `npm run test`. Commit `feat(assessments): filter admin tabs by campus or off-campus (DRRM-025)`.

### Task 7: Pillar pages

**Files:**

- Create: `src/lib/pillar-metrics.ts`, `src/actions/pillars/index.ts`, `src/components/hooks/use-pillars.ts`, `src/app/(pillars)/pillars/page.tsx`, `src/app/(pillars)/pillars/_components/pillar-overview.tsx`, `src/app/(pillars)/pillars/[pillar]/_components/pillar-metrics.tsx`
- Test: `src/lib/pillar-metrics.test.ts`
- Modify: `src/app/(pillars)/pillars/[pillar]/page.tsx`, `src/lib/pillars.ts:9-11`

**Interfaces:**

- Consumes: `rollupDetails` (Task 5), `campusBuildings`, `offCampusBuildings` (Task 2), `sectionScores`, `mostFailed`, `poolBuildings`, `pointsChange`
- Produces in `src/lib/pillar-metrics.ts`:
  - `naRate(t: Tally): number | null`, null when nothing was answered
  - `mostNa(facts: AnswerFact[], currentIds: string[], pillar: PillarCode, limit = 5): { label: string; prompt_en: string; prompt_fil: string; na: number; of: number }[]`
  - `lowestBuildings(buildings: BuildingScores[], pillar: PillarCode, limit = 5): { id: string; name: string; label: string; tally: Tally }[]`
  - `pillarGroup(buildings, facts, ids, pillar): PillarGroup`
  - `recoveryGroup(buildings): { in_place: number; missing: number; na: number; missingBuildings: Named[] }`
- Produces in `src/actions/pillars/index.ts`:
  - `getPillarMetrics(token, slug, campusId): Promise<PillarMetrics | null>`, null for a non-admin or unknown slug, where `PillarMetrics` is `{ kind: 'scored'; campus: PillarGroup; off_campus: PillarGroup } | { kind: 'recovery'; campus: RecoveryGroup; off_campus: RecoveryGroup }` and `RecoveryGroup` is what `recoveryGroup` returns
  - `getPillarOverview(token, campusId): Promise<{ pillar: PillarCode; campus: Tally; off_campus: Tally }[] | null>`

- [ ] **Step 1: Write the failing tests in `src/lib/pillar-metrics.test.ts`**

```ts
test('naRate is N/A over everything answered');
// naRate({ safe: 6, counted: 8, na: 2 }) === 0.2

test('naRate is null when nothing was answered');

test('mostNa counts only this pillar and the latest assessments');
// fixtures with another pillar and an older assessment id

test('mostNa orders by count, then label, and keeps the limit');

test('lowestBuildings skips buildings that counted nothing in this pillar');
// an all-N/A building isn't listed as lowest

test('section scores only include this pillar');
// a section's tally from pillarGroup ignores another pillar's answers in that section

test('recoveryGroup counts in place, missing and N/A, and lists the missing buildings');
```

- [ ] **Step 2: Run them to verify they fail, implement, and run them to verify they pass.** Run: `npx tsx --test src/lib/pillar-metrics.test.ts`.

- [ ] **Step 3: Add the actions and hooks.** Each action calls `requireAdmin(token, campusId)` and loads both categories separately. The `rehabilitation-recovery` slug returns `kind: 'recovery'`, and the other three return `kind: 'scored'`.

- [ ] **Step 4: Build `pillar-metrics.tsx`.** Replace the "Coming soon" note on `/pillars/<slug>` and keep the header, the example activities and the pillar nav.
  - Show the section 3 metrics, with Campus and Off-campus side by side and building counts always visible. Reuse `GroupedBars`.
  - Use `useScopedCampusId` and show which campus is in view, because this route has no switcher.
  - With no off-campus assessments, show `No off-campus assessments yet.`

- [ ] **Step 5: Add `/pillars`.** Read the Next.js routing guide first. Show a table of the four pillars with Campus and Off-campus scores, each row linking through `pillarHref`. Recovery shows counts, not a percent.

- [ ] **Step 6: Update the comments** at `src/lib/pillars.ts:9-11` and `[pillar]/page.tsx:12`, so they no longer call these placeholders.

- [ ] **Step 7: Verify and commit.** Run `npm run type-check`, `npm run lint`, `npm run test`. Check `/pillars` and all four pillar pages in the browser as Administrator and Super Admin. Commit `feat(pillars): show campus and off-campus metrics per pillar (DRRM-025)`.

### Task 8: Documentation and final checks

**Files:**

- Create: `docs/decisions/0010-off-campus-buildings.md`
- Modify: `docs/modules/assessments.md`, `assessment-admin.md`, `building-safety.md`, `pillars-and-landing.md`, `database.md`, `offline-pwa.md`, `settings-lookups.md`, `docs/changelog.md`, this plan's status

- [ ] **Step 1: Write the decision note.** Cover the two building shapes, why location is PSGC on the phone, and why off-campus stays out of campus scores.

- [ ] **Step 2: Update the module notes and their `updated` dates.** Include the new SQL file in the list in `database.md`.

- [ ] **Step 3: Run every section 5 check.** Commit `docs(DRRM-025): record off-campus assessments`.

---

## 5. Verification & Rollout Plan

- [ ] `npm run lint`, `npm run type-check`, `npm run test` and `npm run build` all pass.
- [ ] **Campus numbers don't move.** Note the All campuses and per-campus numbers before Task 2, submit an off-campus assessment, and confirm they're identical. Campus drill-down, Assessments tabs, details and print look unchanged.
- [ ] **Offline.** An older draft and an older queued assessment, made on `main` before switching branches, still submit as campus.
- [ ] **Access.** An Administrator can't open another campus's off-campus building by URL on the dashboard, details or compare pages.
- [ ] **Rollout order.** Run the SQL on each database before deploying the code. Production uses the Supabase SQL editor. This needs a release-owner go-ahead and isn't part of this plan's tasks.
