# DRRM-015 Phase 1: MATATAG assessment form, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** `[Draft]`
- **Branch:** `feat/DRRM-015-assessment-form`, in this worktree (`workspaces/drrmh-irs/Form`) only

**Goal:** An ERT member can sign in, choose Assessment, run the MATATAG checklist for one building on their phone (pre-screen, sections, review), save it as they go, and submit it online or offline. The result is stored with its pillar scores.

**Architecture:** The checklist lives in the database as a versioned template, seeded from a typed data file. Its pure logic (which items apply, scores, the draft → payload step) sits in `src/lib` and is unit-tested against the real checklist data. The ERT pages keep the draft in IndexedDB and submit through one bundled server action. That action verifies the caller's Supabase token and replays from the offline queue like field reports.

**Tech stack:** Next.js 16 (App Router, server actions), Prisma 7 + `@prisma/adapter-pg`, Supabase Auth, TanStack Query 5, Zustand, react-hook-form + Zod 3, IndexedDB, `node:test` through `tsx`.

**Spec:** `docs/plan/feature/DRRM-015-assessment-form.md`. Phase 1 = its Tasks 1–8 + docs. Read Sections 3, 4.1, 5.3, 5.6–5.9 of the spec before starting.

## Deviations from the spec (decided while planning; check these)

1. **Seed:** a separate `prisma/seed-matatag.ts` (`npm run seed:matatag`) instead of a step inside `prisma/seed.ts`. The existing seed creates its events and reports again on every run, so it can't be re-run on a database that already has data.
2. **`getAssessmentSetup(campusId)`** replaces `getBuildings(unitId)`. It returns the campus's clusters with their units, its buildings and the event options in one bundle, cached as one offline entry. The evaluator can then change cluster or unit while offline.
3. **Expected failures are returned, not thrown.** `createAssessment` returns `{ ok: true, id } | { ok: false, error, retry }`. Next.js hides thrown server-action messages in production (`node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`). `retry: true` keeps a queued entry waiting instead of marking it failed. `requireProfile(token)` returns a result for the same reason.
4. **The payload carries `evaluator_id`.** The server accepts it only when it matches the verified caller. On a shared phone, a queued assessment waits for its own evaluator to sign in instead of being filed under whoever is signed in.
5. **Notes stay inside the prompt text** as extracted (e.g. "… Note: Sprinklers should be installed …"). `note_en` / `note_fil` stay empty for now.
6. **`npm run test`** (Node's test runner through `tsx`) covers the pure logic. There are no UI tests; UI tasks end with a manual check.
7. **The items' unique key** is `(section_id, COALESCE(parent_id, zero uuid), code)`, which works on any Postgres version. `NULLS NOT DISTINCT` needs PG 15+.

## Global constraints

- Never run `npx prisma db push`, `prisma migrate dev` or `prisma migrate reset`. Schema changes go only through `prisma/manual/DRRM-015-assessment.sql` (idempotent) plus `prisma/schema.prisma`.
- Prisma CLI in this worktree: `.env` doesn't exist, so prefix every Prisma CLI call with the worktree env. Below, `PRISMA` means `node --env-file=.env.development.local node_modules/prisma/build/index.js`.
- **Ask the user before** every command that writes to the test database (the SQL apply in Task 1, the seed in Task 3). That database is this worktree's own Supabase project, not the `dev` worktree's.
- All DB access goes through `'use server'` functions in `src/actions/<domain>/index.ts`. Components never import Prisma.
- Zod schemas live in `src/lib/schemas.ts`. Forms use react-hook-form + `@hookform/resolvers/zod`.
- Theme tokens only: `bg-canvas` pages, `bg-surface` cards/bars/drawers/inputs, `border-line` hairlines, `bg-brand-solid` maroon fills. No `dark:` variants for gray/brand classes.
- Don't hand-order imports or Tailwind classes. Run `npm run lint:fix` before each commit.
- Breakpoints: phone is the base, `md` tablet, `lg` web. Check at 320 / 390 / 900 / 1280 px, light and dark.
- Commit messages: `feat(assessment): …` / `chore(assessment): …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Copy fixed by the spec, used verbatim:
  - "Saved on this phone — sends when you're back online"
  - "{n} answers for {Area} will be set aside. They come back if you tick it again."
  - "Needs structural follow-up"
  - "From the last assessment on {date} — check it's still right"
  - "Yes here means a hazard"
  - "Public Service Continuity Plan: In place / Missing / N/A"
  - "Checklist language", with options "English + Filipino" / "English" / "Filipino"

## Review Focus

1. **Shared phone, different account at send time.** ERT member A queues an assessment offline and signs out, then B signs in and the phone goes online. A's entry must stay waiting, not be filed under B, and B must not see A's drafts. Covered by `toPayload` carrying `evaluator_id` (Task 6 test), the server check (Task 7), the hub filter (Task 11) and the manual check in Task 14.
2. **Signed out or expired session when the queue flushes.** The entry must stay pending, not turn "failed" for good, and send after sign-in. `retry: true` (Task 7) maps to a network-style error in the provider (Task 8); manual check in Task 14.
3. **Double submit / replay of the same draft** must create one assessment. Unique `client_ref` (Task 1); `createAssessment` returns the existing id, including on a P2002 race (Task 7); manual check in Task 14.
4. **Re-running the seed must keep item ids**, or drafts on phones lose their answers. Seed upserts by code path (Task 3); the id fingerprint must be equal across two runs (Task 3 step).
5. **Floors typed as 0, blank or a fraction** must clamp to a whole number from 1 to 200, never break or overwrite the draft. `clampFloors` (Task 6 test), used by the building step (Task 12).

## File map

| Path                                                                                           | Responsibility                                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/manual/DRRM-015-assessment.sql`                                                        | All Phase 1–3 tables, enums, constraints, RLS                                                                                       |
| `prisma/schema.prisma`                                                                         | Matching models + back-relations                                                                                                    |
| `prisma/data/matatag-2025-07-25.ts` (+ `.test.ts`)                                             | The checklist as typed data (generated once from the old branch), and its integrity tests                                           |
| `prisma/seed-matatag.ts`                                                                       | Idempotent seed of pillars, area types, template, version, sections, items                                                          |
| `src/lib/assessment-template.ts`                                                               | Shared types (data, template, setup, records), constants, `templateFromData`, `itemLabel`                                           |
| `src/lib/assessment-score.ts` (+ test)                                                         | `applicableItems`, `areaQuestionCounts`, `scoreAssessment`, `percent`, `recoveryStatus`, `prepareAssessmentWrite`                   |
| `src/lib/assessment-draft.ts` (+ test)                                                         | Draft type and pure draft operations, `toPayload`, `newUuid`                                                                        |
| `src/lib/access.ts` (+ test)                                                                   | `canUseAssessment`                                                                                                                  |
| `src/lib/server-auth.ts`                                                                       | `requireProfile(token)` (server only)                                                                                               |
| `src/lib/supabase.ts`                                                                          | + `getAccessToken()`                                                                                                                |
| `src/lib/schemas.ts` (+ test)                                                                  | + `assessmentPayloadSchema`, `assessmentDetailsSchema`                                                                              |
| `src/lib/offline-queue.ts`                                                                     | DB v3: `assessments` queue, `assessment-drafts`, `assessment-cache`, `getAllQueuedCount`                                            |
| `src/actions/assessments/index.ts`                                                             | Template, setup, create, my list, my record                                                                                         |
| `src/components/hooks/use-assessments.ts`                                                      | Query hooks with offline cache, drafts, submit mutation                                                                             |
| `src/components/pwa/offline-queue-provider.tsx`                                                | + flush the assessments queue                                                                                                       |
| `src/lib/question-language.ts`, `src/store/question-language.store.ts`                         | Language preference                                                                                                                 |
| `src/components/assessment/bilingual.tsx`, `question-language-setting.tsx`                     | `<Bilingual>` and the My profile setting                                                                                            |
| `src/app/(ert)/_components/` (moved: `frame`, `chrome`, `top-bar`, `waiting-to-send`)          | ERT chrome shared by `/home`, `/report`, `/assessment`; `top-bar` gains the switch                                                  |
| `src/app/(ert)/_lib/` (moved: `format`, `use-field-queue`; new: `use-ert-access`, `use-assessment-queue`) | Shared ERT helpers                                                                                                         |
| `src/app/(ert)/home/page.tsx`                                                                  | `/home` chooser                                                                                                                     |
| `src/app/(ert)/assessment/page.tsx` + `_components/`                                           | Hub, stepper (details, building, section, index, review), read-only view, score summary                                             |

---

### Task 1: Schema

**Files:**

- Create: `prisma/manual/DRRM-015-assessment.sql`
- Modify: `prisma/schema.prisma` (new enums/models; back-relations on `Unit`, `Event`, `User`)

**Interfaces:**

- Produces Prisma accessors: `prisma.drrmPillar`, `buildingAreaType`, `assessmentTemplate`, `assessmentTemplateVersion`, `assessmentSection`, `assessmentItem`, `building`, `buildingArea`, `assessment`, `assessmentArea`, `assessmentAnswerRow`, `assessmentPillarScore`, `assessmentSectionComment`.
- Produces enums: `AssessmentAnswer` (`yes no na` → `assessment_answer`), `AssessmentSafeAnswer` (`yes no` → `assessment_safe_answer`), `AssessmentVersionStatus` (`draft published retired` → `assessment_version_status`).
- Relation field names later tasks use:

| Model                       | Relation fields                                                                                                                                                               |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AssessmentTemplateVersion` | `template`, `sections`, `assessments`, `publisher` ("VersionPublishedBy"), `creator` ("VersionCreatedBy")                                                                     |
| `AssessmentSection`         | `version`, `area_type`, `items`, `comments`                                                                                                                                   |
| `AssessmentItem`            | `section`, `parent` / `children` ("ItemChildren"), `area_type`, `pillar`, `answers`                                                                                           |
| `Building`                  | `unit`, `creator` ("BuildingCreatedBy"), `areas`, `assessments`                                                                                                               |
| `Assessment`                | `version`, `building`, `event`, `evaluator` ("AssessmentEvaluator"), `areas`, `answers`, `pillar_scores`, `comments`                                                          |
| Back-relations              | `Unit.buildings`, `Event.assessments`, `User.assessments`, `User.created_buildings`, `User.published_versions`, `User.created_versions`, `DrrmPillar.items`, `DrrmPillar.scores` |

- [ ] **Step 1: Switch this worktree to the feature branch**

Run: `git switch feat/DRRM-015-assessment-form && git status --short`
Expected: on `feat/DRRM-015-assessment-form`; only `docs/plan/feature/DRRM-015-*.md` untracked.

- [ ] **Step 2: Write `prisma/manual/DRRM-015-assessment.sql`**

Follow the header style of `prisma/manual/DRRM-011-super-admin-v2.sql`. "HOW TO APPLY" names the test-database command (Step 5) and the Supabase SQL editor for production. The body runs in one `BEGIN … COMMIT`:

- The three enums, each in a `DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = …)` block.
- The 13 tables of spec Section 5.3, each `CREATE TABLE IF NOT EXISTS public.<name>`. Use `UUID PRIMARY KEY DEFAULT gen_random_uuid()` where the table has an `id`, and `TIMESTAMPTZ NOT NULL DEFAULT now()` timestamps.
- Delete rules:
  - children of versions, sections and items: `ON DELETE CASCADE`
  - `assessments.event_id`: `ON DELETE SET NULL`
  - `*_by` → users: `ON DELETE SET NULL`
  - every other foreign key: `NO ACTION`.
- These named constraints and indexes (the names matter for later `pg_constraint` checks and for Prisma `map:`):

| Name                                     | Definition                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `uq_template_versions_label`             | UNIQUE (`template_id`, `label`)                                                                     |
| `uq_template_versions_one_published`     | UNIQUE INDEX on (`template_id`) WHERE `status = 'published'`                                        |
| `uq_assessment_sections_code`            | UNIQUE (`version_id`, `code`)                                                                       |
| `uq_assessment_items_code`               | UNIQUE INDEX on (`section_id`, `COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)`, `code`) |
| `chk_assessment_items_pillar`            | `(is_scored AND pillar_id IS NOT NULL) OR (NOT is_scored AND pillar_id IS NULL)`                   |
| `chk_assessment_items_min_floors`        | `min_floors IS NULL OR min_floors >= 1`                                                             |
| `idx_assessment_items_section_order`     | INDEX (`section_id`, `sort_order`)                                                                  |
| `uq_buildings_unit_name`                 | UNIQUE INDEX on (`unit_id`, `lower(name)`)                                                          |
| `chk_buildings_floor_count`              | `floor_count >= 1`                                                                                  |
| `chk_assessments_floor_count`            | `floor_count >= 1`                                                                                  |
| `chk_assessments_times`                  | `ended_at >= started_at`                                                                            |
| `idx_assessments_building_ended`         | INDEX (`building_id`, `ended_at DESC`)                                                              |
| `idx_assessments_evaluator`              | INDEX (`evaluator_id`)                                                                              |
| `uq_assessment_answers_item`             | UNIQUE (`assessment_id`, `item_id`)                                                                 |
| `chk_assessment_answers_content`         | `answer IS NOT NULL OR remarks IS NOT NULL`                                                         |
| `chk_assessment_pillar_scores_counts`    | `0 <= safe_count AND safe_count <= counted_count AND na_count >= 0`                                 |
| `uq_assessment_section_comments_section` | UNIQUE (`assessment_id`, `section_id`)                                                              |

- `client_ref UUID NOT NULL UNIQUE` on `assessments`. `building_areas`, `assessment_areas` and `assessment_pillar_scores` have composite primary keys, as in the spec.
- Add each named constraint inside a `DO` block guarded by `pg_constraint` (the DRRM-011 pattern), and each index with `CREATE [UNIQUE] INDEX IF NOT EXISTS`.
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` on all 13 tables, with the DRRM-008 comment: Prisma connects as the owning `postgres` role, and no policies keeps the REST API closed.
- A commented ROLLBACK block that drops the tables in reverse order, then the types.

- [ ] **Step 3: Add the models to `prisma/schema.prisma`**

Follow spec Section 5.4 and the tables above:

- Field names in snake_case, matching the columns. Each model gets `@@map`, and each enum gets `@@map`.
- `@@id([...])` on the three composite-key tables.
- `@@unique(..., map: ...)` only for `uq_template_versions_label`, `uq_assessment_sections_code`, `uq_assessment_answers_item` and `uq_assessment_section_comments_section`.
- No Prisma `@@unique` for the expression and partial indexes. Note them in `///` comments instead.
- `@@index([building_id, ended_at(sort: Desc)], map: "idx_assessments_building_ended")`.

- [ ] **Step 4: Validate, generate, type-check**

Run: `$PRISMA validate && $PRISMA generate && npm run type-check`
Expected: "The schema at prisma/schema.prisma is valid", "Generated Prisma Client", then no type errors.

- [ ] **Step 5: Apply to the test database (ask the user first)**

Run: `$PRISMA db execute --file prisma/manual/DRRM-015-assessment.sql`, then the same command again.
Expected: "Script executed successfully." both times (idempotent).

- [ ] **Step 6: Commit**

```bash
git add prisma/manual/DRRM-015-assessment.sql prisma/schema.prisma docs/plan/feature/DRRM-015-assessment-form.md docs/plan/feature/DRRM-015-phase-1-plan.md
git commit -m "feat(assessment): add MATATAG assessment schema"
```

---

### Task 2: Checklist data and shared types

**Files:**

- Create: `src/lib/assessment-template.ts`, `prisma/data/matatag-2025-07-25.ts`, `prisma/data/matatag-2025-07-25.test.ts`
- Modify: `package.json` (scripts)

**Interfaces (produces, all in `src/lib/assessment-template.ts`):**

```ts
export const AREA_CODES = ['corridors', 'bathrooms', 'offices', 'classrooms', 'laboratories', 'athletic', 'dormitories', 'playground', 'swimming_pool', 'stairwells'] as const;
export type AreaCode = (typeof AREA_CODES)[number];
export const PILLAR_CODES = ['prevention-mitigation', 'preparedness', 'response', 'rehabilitation-recovery'] as const;
export type PillarCode = (typeof PILLAR_CODES)[number];
export type AnswerValue = 'yes' | 'no' | 'na';
export type SafeAnswer = 'yes' | 'no';
export const STRUCTURAL_FLAG = 'Needs structural follow-up';

// Source data (prisma/data): codes, no ids. An item with `items` is a group parent (not scored).
export interface ChecklistItemData { code: string; en: string; fil: string; reference?: string; pillar?: PillarCode; area?: AreaCode; safe?: 'no'; minFloors?: number; flag?: string; items?: ChecklistItemData[] }
export interface ChecklistSectionData { code: string; en: string; fil: string; area?: AreaCode; items: ChecklistItemData[] }
export interface ChecklistData { template: { code: string; name: string; description: string }; versionLabel: string; areaTypes: { code: AreaCode; en: string; fil: string }[]; sections: ChecklistSectionData[] }

// The template as the app uses it. Items are flat, in sort order (a parent right before its children).
export interface TemplateAreaType { id: string; code: string; name_en: string; name_fil: string }
export interface TemplateItem { id: string; section_id: string; parent_id: string | null; code: string; prompt_en: string; prompt_fil: string; note_en: string | null; note_fil: string | null; reference: string | null; is_scored: boolean; safe_answer: SafeAnswer; area_type_id: string | null; min_floors: number | null; flag_label: string | null; pillar_code: PillarCode | null }
export interface TemplateSection { id: string; code: string; title_en: string; title_fil: string; area_type_id: string | null; items: TemplateItem[] }
export interface AssessmentTemplate { version_id: string; label: string; area_types: TemplateAreaType[]; sections: TemplateSection[] }

/** The template straight from data: ids are code paths ("III", "III/4", "III/4.1"), area ids are area codes, version_id is "data". For tests. */
export function templateFromData(data: ChecklistData): AssessmentTemplate;
/** "III.4.1": section code + "." + item code. */
export function itemLabel(section: { code: string }, item: { code: string }): string;
```

Task 7 adds the action result types (`AssessmentSetup`, `BuildingOption`, `MyAssessmentRow`, `AssessmentRecord`, `CreateAssessmentResult`) to this file.

- [ ] **Step 1: Add the test script to `package.json`**

`"test": "tsx --test \"src/**/*.test.ts\" \"prisma/**/*.test.ts\""`

- [ ] **Step 2: Write the failing data test, `prisma/data/matatag-2025-07-25.test.ts`**

```ts
import { itemLabel, PILLAR_CODES, STRUCTURAL_FLAG, templateFromData } from '@/lib/assessment-template';
import { PILLARS } from '@/lib/pillars';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MATATAG_2025_07_25 } from './matatag-2025-07-25';

const T = templateFromData(MATATAG_2025_07_25);
const items = T.sections.flatMap((s) => s.items.map((i) => ({ ...i, label: itemLabel(s, i) })));
const scored = items.filter((i) => i.is_scored);
const labels = (list: typeof items) => list.map((i) => i.label).sort();
const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, k) => `${prefix}${from + k}`);

test('17 sections, 211 scored items, counts per section', () => {
  assert.deepEqual(T.sections.map((s) => s.code), ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII']);
  const per = Object.fromEntries(T.sections.map((s) => [s.code, s.items.filter((i) => i.is_scored).length]));
  assert.deepEqual(per, { I: 12, II: 7, III: 15, IV: 22, V: 25, VI: 33, VII: 7, VIII: 8, IX: 7, X: 3, XI: 5, XII: 9, XIII: 16, XIV: 13, XV: 5, XVI: 4, XVII: 20 });
  assert.equal(scored.length, 211);
});

test('13 group parents, unscored and without a pillar', () => {
  const groups = items.filter((i) => !i.is_scored);
  assert.deepEqual(labels(groups), ['I.3', 'III.2', 'III.4', 'IV.1', 'IV.2', 'IV.3', 'V.5', 'V.6', 'V.7', 'VI.1', 'VI.2', 'VI.7', 'VI.8'].sort());
  assert.ok(groups.every((g) => g.pillar_code === null));
});

test('every scored item has one pillar: 149 / 24 / 37 / 1', () => {
  assert.ok(scored.every((i) => i.pillar_code !== null));
  const of = (code: string) => labels(scored.filter((i) => i.pillar_code === code));
  assert.deepEqual(of('preparedness'), ['I.1', 'I.2', 'I.3.1', 'I.3.2', 'I.3.4', 'I.4', 'I.5', 'I.6', 'I.7', 'I.8', 'V.1', 'V.2', 'V.4', ...range('V.7.', 1, 7), 'XIII.14', 'XVII.1', 'XVII.4', 'XVII.16'].sort());
  assert.deepEqual(of('response'), ['I.9', ...range('III.2.', 1, 6), 'V.3', ...range('V.5.', 1, 7), 'VII.3', ...range('VIII.', 1, 6), 'VIII.8', 'XI.5', 'XII.9', 'XIII.3', 'XIII.6', 'XIII.7', 'XIII.8', 'XIII.12', 'XIII.13', 'XVI.2', 'XVII.6', 'XVII.12', 'XVII.17', 'XVII.19', 'XVII.20'].sort());
  assert.deepEqual(of('rehabilitation-recovery'), ['I.3.3']);
  assert.equal(of('prevention-mitigation').length, 149);
});

test('pillar codes are the DRRM-014 PILLARS slugs, in order', () => {
  assert.deepEqual(PILLARS.map((p) => p.slug), [...PILLAR_CODES]);
});

test('reverse-scored, sprinkler and structural-flag items', () => {
  assert.deepEqual(labels(scored.filter((i) => i.safe_answer === 'no')), ['II.3', ...range('VI.1.', 1, 7), 'VI.9'].sort());
  assert.deepEqual(labels(scored.filter((i) => i.min_floors === 3)), [...range('V.6.', 1, 7), 'XVII.13'].sort());
  assert.deepEqual(labels(scored.filter((i) => i.flag_label === STRUCTURAL_FLAG)), range('VI.1.', 1, 7).sort());
});

test('area gating of sections and sub-items', () => {
  const sectionAreas = Object.fromEntries(T.sections.filter((s) => s.area_type_id).map((s) => [s.code, s.area_type_id]));
  assert.deepEqual(sectionAreas, { VII: 'stairwells', IX: 'bathrooms', XI: 'offices', XII: 'classrooms', XIII: 'laboratories', XIV: 'playground', XV: 'athletic', XVI: 'swimming_pool', XVII: 'dormitories' });
  const byArea = (code: string) => labels(items.filter((i) => i.area_type_id === code));
  assert.deepEqual(byArea('corridors'), ['III.4.1', 'IV.1.2', 'IV.2.1', 'IV.3.1', 'V.5.1', 'V.6.1', 'V.7.1', 'VI.1.1', 'VI.2.1', 'VI.7.1', 'VI.8.1'].sort());
  for (const area of ['bathrooms', 'offices', 'classrooms', 'laboratories', 'athletic', 'dormitories']) {
    assert.equal(byArea(area).length, 12, area);
  }
  assert.equal(items.find((i) => i.label === 'IV.1.1')?.area_type_id, null);
  assert.deepEqual(T.area_types.map((a) => a.code), ['corridors', 'bathrooms', 'offices', 'classrooms', 'laboratories', 'athletic', 'dormitories', 'playground', 'swimming_pool', 'stairwells']);
});

test('English and Filipino text everywhere', () => {
  assert.ok(T.sections.every((s) => s.title_en.trim() && s.title_fil.trim()));
  assert.ok(items.every((i) => i.prompt_en.trim() && i.prompt_fil.trim()), 'item text');
  assert.ok(T.area_types.every((a) => a.name_en.trim() && a.name_fil.trim()));
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npm run test`
Expected: FAIL, cannot find module `@/lib/assessment-template` / `./matatag-2025-07-25`.

- [ ] **Step 4: Implement `src/lib/assessment-template.ts`**

Types and constants as above. `templateFromData` walks sections → items → `items` (children):

- Sort order is the array order.
- A data item without `items` is scored (`is_scored = true`).
- `safe_answer = item.safe ?? 'yes'`, `min_floors = minFloors ?? null`, `flag_label = flag ?? null`, `pillar_code = pillar ?? null`, `reference = reference ?? null`, notes `null`.
- `area_types` comes from `data.areaTypes` with `id = code`.

- [ ] **Step 5: Generate `prisma/data/matatag-2025-07-25.ts` with a throwaway script**

Write the script in the scratchpad, not the repo. It reads `../MATATAG/src/lib/matatag-checklist.json` (sections → `items[]` with `number`, `group`, `id` like `"III-4.1"`) and `../MATATAG/src/lib/matatag-question-content.json` (`sections[code].{en,fil}`, `items[id].{en,fil,reference}`). It writes `export const MATATAG_2025_07_25: ChecklistData = {…}`. Rules:

- **Template:** `{ code: 'MATATAG', name: 'MATATAG', description: 'Monitoring and Assessment Tool for Area Threats and Accident Generators (UP Resilience Institute)' }`, `versionLabel: 'Ver. July 25, 2025'`.
- **Nesting:** a `group: true` item takes, as `items`, the items that follow it whose `number` starts with `` `${number}.` ``. `code` = the `number` ("4" / "4.1").
- **Text:** `en` / `fil` come from the content file. Strip a leading `/^References?:\s*/` from `reference`, and leave out empty references.
- **Sub-item areas, by English label:**
  - "Corridors" → `corridors`
  - "Bathrooms" → `bathrooms`
  - "Offices" → `offices`
  - "Classrooms/ Multi-purpose Rooms/ Libraries" → `classrooms`
  - "Laboratories" → `laboratories`
  - "Athletic Facilities/ Gymnasium" → `athletic`
  - "Dormitories" → `dormitories`
  - "Building Exterior and Grounds" (IV.1.1) and the I.3.x plan names → no area.
- **Section areas:** VII `stairwells`, IX `bathrooms`, XI `offices`, XII `classrooms`, XIII `laboratories`, XIV `playground`, XV `athletic`, XVI `swimming_pool`, XVII `dormitories`.
- **`areaTypes`** in `AREA_CODES` order:
  - The seven room areas take `en` / `fil` from their sub-item rows III.4.1 … III.4.7.
  - `playground`, `swimming_pool` and `stairwells` use `en` "Playground" / "Swimming pool" / "Stairwells", with `fil` from the XIV / XVI / VII section titles.
- **Pillars:** the Preparedness, Response and Recovery lists exactly as in the Step 2 test (spec Section 4.1). Every other scored item is `prevention-mitigation`. Group parents get no pillar.
- **Gating:**
  - `safe: 'no'` on II.3, VI.1.1–VI.1.7, VI.9
  - `minFloors: 3` on V.6.1–V.6.7 and XVII.13
  - `flag: STRUCTURAL_FLAG` (written as the string) on VI.1.1–VI.1.7.

Then run `npx prettier --write prisma/data/matatag-2025-07-25.ts`.

- [ ] **Step 6: Run the tests**

Run: `npm run test`
Expected: PASS, 7 tests. If a count is off, fix the generator rule (not the test), then regenerate.

- [ ] **Step 7: Spot-check against the PDF**

Open `../MATATAG/public/matatag-reference.pdf`. Compare three prompts (I.7, V.4, XVII.13) in English and Filipino, word for word.
Expected: identical apart from whitespace.

- [ ] **Step 8: Commit**

```bash
npm run lint:fix
git add package.json src/lib/assessment-template.ts prisma/data
git commit -m "feat(assessment): add MATATAG checklist data and template types"
```

---

### Task 3: Seed

**Files:**

- Create: `prisma/seed-matatag.ts`
- Modify: `package.json` (`"seed:matatag": "tsx prisma/seed-matatag.ts"`)

**Interfaces:**

- Consumes: `MATATAG_2025_07_25`, `ChecklistData`, `PILLAR_CODES`; `PILLARS` (`slug`, `name`) from `@/lib/pillars`.
- Produces: rows the app reads. Exactly one `published` MATATAG version, labelled "Ver. July 25, 2025".

- [ ] **Step 1: Implement `prisma/seed-matatag.ts`**

- **Setup:** load env with `config({ path: ['.env.development.local', '.env'], quiet: true })` from `dotenv`. Use its own `PrismaClient` on `DATABASE_URL`, as `prisma/seed.ts` does with its adapter. Print the target host (no credentials) first.
- **Pillars:** upsert the four `drrm_pillars` by `code`, using `name` from `PILLARS` and `sort_order` from the array index.
- **Area types:** upsert by `code`, with `name_en`, `name_fil` and `sort_order`.
- **Template and version:**
  - Upsert the template by `code`.
  - Find the version by (`template_id`, `label`). Create it if missing: `status` `published` if no other version of the template is published, else `draft`; `published_at` now.
  - If the version has any `assessments`, print "in use, left as is" and stop.
- **Sections and items, by code path:**
  - Load the version's existing sections and items once.
  - Upsert each section by `code`, and each item by (`section`, `parent`, `code`).
  - Create the missing ones with `createManyAndReturn`: top-level items first, then children, with `parent_id` from the returned rows. `pillar_id` comes from the pillar code, `area_type_id` from the area code.
  - Update a row only when a field differs.
  - Never delete. Print any extra existing codes as warnings.
- **Report:** print created / updated / unchanged counts, scored items per section and per pillar, read back from the database, and `fingerprint`: the first 12 hex characters of the SHA-1 of the sorted item ids.

- [ ] **Step 2: Type-check**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Run the seed on the test database (ask the user first)**

Run: `npm run seed:matatag`
Expected:

- per section I 12 … XVII 20 (as in the Task 2 test)
- per pillar 149 / 24 / 37 / 1
- "created" ≈ 17 sections + 224 items
- a fingerprint.

- [ ] **Step 4: Run it again**

Run: `npm run seed:matatag`
Expected: 0 created, 0 updated, and the **same fingerprint** as Step 3.

- [ ] **Step 5: Commit**

```bash
git add package.json prisma/seed-matatag.ts
git commit -m "feat(assessment): seed the MATATAG template"
```

---

### Task 4: Applicability and scoring

**Files:**

- Create: `src/lib/assessment-score.ts`, `src/lib/assessment-score.test.ts`

**Interfaces (produces):**

```ts
export interface Tally { safe: number; counted: number; na: number }
export type AnswerMap = Record<string, AnswerValue | null | undefined>; // by item id
/** Items that apply, in template order. A group parent is included only when one of its sub-items applies. */
export function applicableItems(template: AssessmentTemplate, floors: number, areaTypeIds: Iterable<string>): TemplateItem[];
/** Scored items gated by each area type (its section's area or its own), counting min_floors. Keyed by area type id. */
export function areaQuestionCounts(template: AssessmentTemplate, floors: number): Record<string, number>;
export interface AssessmentScore { overall: Tally; pillars: Record<PillarCode, Tally>; sections: Record<string, Tally>; unanswered: TemplateItem[]; unsafe: TemplateItem[]; needsFollowUp: boolean }
export function scoreAssessment(template: AssessmentTemplate, floors: number, areaTypeIds: Iterable<string>, answers: AnswerMap): AssessmentScore;
export function percent(t: Tally): number | null; // Math.round(100 * safe / counted); null when counted is 0
export function recoveryStatus(t: Tally): 'in_place' | 'missing' | 'na';
export interface WriteInput { floor_count: number; area_type_ids: string[]; answers: { item_id: string; answer: AnswerValue | null; remarks: string | null }[]; comments: { section_id: string; comment: string }[] }
export interface PreparedAssessment { answers: WriteInput['answers']; comments: WriteInput['comments']; pillarTallies: Record<PillarCode, Tally>; needsFollowUp: boolean; missing: number }
/** Server-side: keep only applicable items (template order), null the answer on group parents, trim remarks ('' → null), drop empty rows and comments of sections that don't apply. */
export function prepareAssessmentWrite(template: AssessmentTemplate, input: WriteInput): PreparedAssessment;
```

Rules:

- **Applicability:** an item applies when all of these hold:
  - its section's `area_type_id` is null or ticked
  - its own `area_type_id` is null or ticked
  - `floors >= min_floors` (when set)
  - its parent applies.
- **`sections`** has an entry only for sections with at least one applicable scored item.
- **`safe`:** answer = `safe_answer`. **`counted`:** answer is yes or no. **`na`:** answer is na.
- **`unsafe`:** the counted items that aren't safe.
- **`needsFollowUp`:** some unsafe item has a `flag_label`.

- [ ] **Step 1: Write the failing test, `src/lib/assessment-score.test.ts`**

```ts
import { MATATAG_2025_07_25 } from '../../prisma/data/matatag-2025-07-25';
import { AREA_CODES, PILLAR_CODES, templateFromData, type AnswerValue } from './assessment-template';
import { applicableItems, areaQuestionCounts, percent, prepareAssessmentWrite, recoveryStatus, scoreAssessment } from './assessment-score';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const T = templateFromData(MATATAG_2025_07_25);
const id = (label: string) => label.replace('.', '/'); // 'III.4.1' → 'III/4.1'
const scoredCount = (floors: number, areas: readonly string[]) =>
  applicableItems(T, floors, areas).filter((i) => i.is_scored).length;
const OFFICE = ['offices'];

test('pre-screen counts from the spec (Sections 3.3–3.4)', () => {
  assert.equal(scoredCount(1, []), 42);
  assert.equal(scoredCount(2, ['corridors', 'bathrooms', 'offices', 'stairwells']), 93);
  assert.equal(scoredCount(4, ['corridors', 'bathrooms', 'offices', 'classrooms', 'laboratories', 'stairwells']), 145);
  assert.equal(scoredCount(4, ['corridors', 'bathrooms', 'offices', 'dormitories', 'stairwells']), 128);
  assert.equal(scoredCount(3, AREA_CODES), 211);
});

test('sprinklers need 3 floors; a group parent needs an applicable sub-item', () => {
  const two = applicableItems(T, 2, ['corridors', 'dormitories']).map((i) => i.id);
  assert.ok(!two.includes(id('V.6.1')) && !two.includes(id('XVII.13')) && !two.includes('V/6'));
  const three = applicableItems(T, 3, ['corridors', 'dormitories']).map((i) => i.id);
  assert.ok(three.includes(id('V.6.1')) && three.includes(id('XVII.13')) && three.includes('V/6'));
  assert.ok(!applicableItems(T, 3, ['corridors']).some((i) => i.id === 'III/2'));
  assert.ok(applicableItems(T, 3, ['bathrooms']).some((i) => i.id === 'III/2'));
});

test('questions each area adds', () => {
  assert.deepEqual(areaQuestionCounts(T, 3), { corridors: 11, bathrooms: 19, offices: 17, classrooms: 21, laboratories: 28, athletic: 17, dormitories: 32, playground: 13, swimming_pool: 4, stairwells: 7 });
  const two = areaQuestionCounts(T, 2);
  assert.deepEqual([two.corridors, two.bathrooms, two.dormitories], [10, 18, 30]);
});

test('reverse items: NO is safe on II.3; YES on VI.1.3 needs structural follow-up', () => {
  const score = (answers: Record<string, AnswerValue>) => scoreAssessment(T, 1, OFFICE, answers);
  assert.equal(score({ [id('II.3')]: 'no' }).overall.safe, 1);
  assert.equal(score({ [id('II.3')]: 'yes' }).overall.safe, 0);
  const cracked = score({ [id('VI.1.3')]: 'yes' });
  assert.equal(cracked.needsFollowUp, true);
  assert.deepEqual(cracked.unsafe.map((i) => i.id), [id('VI.1.3')]);
  assert.equal(score({ [id('VI.1.3')]: 'no' }).needsFollowUp, false);
});

test('N/A and non-applicable answers are left out', () => {
  const s = scoreAssessment(T, 1, OFFICE, { [id('II.1')]: 'na', [id('II.2')]: 'yes', [id('XIII.1')]: 'no' });
  assert.deepEqual(s.overall, { safe: 1, counted: 1, na: 1 });
  assert.equal(s.sections['XIII'], undefined);
});

test('the four pillars add up to the overall score', () => {
  const values: AnswerValue[] = ['no', 'yes', 'na'];
  const scored = applicableItems(T, 4, AREA_CODES).filter((i) => i.is_scored);
  const s = scoreAssessment(T, 4, AREA_CODES, Object.fromEntries(scored.map((i, k) => [i.id, values[k % 3]])));
  const sum = PILLAR_CODES.reduce((t, p) => ({ safe: t.safe + s.pillars[p].safe, counted: t.counted + s.pillars[p].counted, na: t.na + s.pillars[p].na }), { safe: 0, counted: 0, na: 0 });
  assert.deepEqual(sum, s.overall);
  assert.equal(s.unanswered.length, 0);
});

test('unanswered = applicable scored items without an answer', () => {
  assert.equal(scoreAssessment(T, 1, OFFICE, {}).unanswered.length, scoredCount(1, OFFICE));
});

test('percent and recovery status', () => {
  assert.equal(percent({ safe: 0, counted: 0, na: 3 }), null);
  assert.equal(percent({ safe: 2, counted: 3, na: 0 }), 67);
  assert.equal(recoveryStatus({ safe: 1, counted: 1, na: 0 }), 'in_place');
  assert.equal(recoveryStatus({ safe: 0, counted: 1, na: 0 }), 'missing');
  assert.equal(recoveryStatus({ safe: 0, counted: 0, na: 1 }), 'na');
});

test('prepareAssessmentWrite keeps only what applies and counts what is missing', () => {
  const p = prepareAssessmentWrite(T, {
    floor_count: 1,
    area_type_ids: OFFICE,
    answers: [
      { item_id: id('II.1'), answer: 'yes', remarks: '  ' },
      { item_id: id('XIII.1'), answer: 'no', remarks: null }, // no labs
      { item_id: 'III/2', answer: 'yes', remarks: 'Door sticks' }, // group parent
      { item_id: 'unknown', answer: 'yes', remarks: null },
    ],
    comments: [{ section_id: 'II', comment: ' Ok ' }, { section_id: 'XIII', comment: 'x' }],
  });
  assert.deepEqual(p.answers, [
    { item_id: id('II.1'), answer: 'yes', remarks: null },
    { item_id: 'III/2', answer: null, remarks: 'Door sticks' },
  ]);
  assert.deepEqual(p.comments, [{ section_id: 'II', comment: 'Ok' }]);
  assert.equal(p.missing, scoredCount(1, OFFICE) - 1);
  assert.equal(p.pillarTallies['prevention-mitigation'].safe, 1);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm run test`
Expected: FAIL, cannot find module `./assessment-score`.

- [ ] **Step 3: Implement `src/lib/assessment-score.ts`**

Use the signatures and rules above. `applicableItems` resolves parents through one pass in template order: a parent comes before its children, so its applicability is known by then. Then a second pass drops group parents with no applicable child.

- [ ] **Step 4: Run the tests**

Run: `npm run test`
Expected: PASS, all data and score tests.

- [ ] **Step 5: Commit**

```bash
npm run lint:fix
git add src/lib/assessment-score.ts src/lib/assessment-score.test.ts
git commit -m "feat(assessment): applicability and scoring"
```

---

### Task 5: Access rule, caller check, payload schema

**Files:**

- Create: `src/lib/access.ts`, `src/lib/access.test.ts`, `src/lib/server-auth.ts`, `src/lib/schemas.test.ts`
- Modify: `src/lib/supabase.ts`, `src/lib/schemas.ts`

**Interfaces (produces):**

```ts
// src/lib/access.ts: the one place the rule lives (spec 5.6, keep its comment about the Safety Officer rule)
export function canUseAssessment(p: { user_type?: { name: string } | null; position?: { name: string } | null } | null | undefined): boolean;

// src/lib/server-auth.ts: imported only by server actions
export type VerifiedProfile = Prisma.UserGetPayload<{ include: { user_type: true; position: true; campus: true; cluster: true; unit: { include: { cluster: true } } } }>;
export type CallerCheck = { ok: true; profile: VerifiedProfile } | { ok: false; reason: 'signed_out' | 'no_profile' | 'inactive' };
export async function requireProfile(token: string | null | undefined): Promise<CallerCheck>;

// src/lib/supabase.ts
/** The signed-in user's access token (refreshed when needed), or null. */
export async function getAccessToken(): Promise<string | null>;

// src/lib/schemas.ts
export const assessmentPayloadSchema: z.ZodType; // fields below
export type AssessmentPayload = z.infer<typeof assessmentPayloadSchema>;
export const assessmentDetailsSchema: z.ZodType;
export type AssessmentDetailsFormData = z.infer<typeof assessmentDetailsSchema>;
```

- **`requireProfile`:**
  - `supabaseAdmin.auth.getUser(token)`. No token, or an error / no user → `signed_out`.
  - Then `prisma.user.findUnique({ where: { auth_id }, include })`. Missing → `no_profile`; `!is_active` → `inactive`.
- **`assessmentPayloadSchema` fields:**
  - `client_ref`, `evaluator_id`, `template_version_id`: `z.string().uuid()`
  - `building`: `z.union([z.object({ id: uuid }), z.object({ new: z.object({ unit_id: uuid, name: z.string().trim().min(1).max(120) }) })])`
  - `event_id`: `uuid.nullable()`
  - `incident_commander`: `z.string().trim().max(200)`
  - `floor_count`: `z.number().int().min(1).max(200)`
  - `area_type_ids`: `z.array(uuid).max(50)`
  - `started_at`, `ended_at`: `z.string().datetime()`
  - `answers`: `z.array(z.object({ item_id: uuid, answer: z.enum(['yes', 'no', 'na']).nullable(), remarks: z.string().max(2000).nullable() })).max(1000)`
  - `comments`: `z.array(z.object({ section_id: uuid, comment: z.string().trim().min(1).max(2000) })).max(100)`.
- **`assessmentDetailsSchema`:**
  - `cluster_id`: `z.string().min(1, 'Choose a cluster')`
  - `unit_id`: `z.string().min(1, 'Choose a college or unit')`
  - `building_id`: `z.string()`
  - `new_building_name`: `z.string().trim().max(120)`
  - `incident_commander`: `z.string().trim().max(200)`
  - `event_id`: `z.string()`
  - `.refine((d) => d.building_id || d.new_building_name, { path: ['building_id'], message: 'Choose a building or add one' })`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/access.test.ts
import { canUseAssessment } from './access';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Phase 1: ERT members only', () => {
  assert.equal(canUseAssessment({ user_type: { name: 'ERT Member' }, position: { name: 'Marshall' } }), true);
  for (const name of ['Administrator', 'Super Admin', 'Bystander']) {
    assert.equal(canUseAssessment({ user_type: { name } }), false, name);
  }
  assert.equal(canUseAssessment(null), false);
});
```

```ts
// src/lib/schemas.test.ts
import { assessmentPayloadSchema } from './schemas';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const U = '7a0c3b9e-3f5b-4d2a-9c1e-2b8f6d4a1e00';
const valid = {
  client_ref: U, evaluator_id: U, template_version_id: U,
  building: { new: { unit_id: U, name: ' Annex ' } }, event_id: null, incident_commander: '',
  floor_count: 2, area_type_ids: [U], started_at: '2026-10-20T01:00:00.000Z', ended_at: '2026-10-20T02:00:00.000Z',
  answers: [{ item_id: U, answer: 'yes', remarks: null }], comments: [],
};

test('assessment payload', () => {
  const parsed = assessmentPayloadSchema.parse(valid);
  assert.deepEqual(parsed.building, { new: { unit_id: U, name: 'Annex' } });
  assert.equal(assessmentPayloadSchema.safeParse({ ...valid, floor_count: 0 }).success, false);
  assert.equal(assessmentPayloadSchema.safeParse({ ...valid, answers: [{ item_id: U, answer: 'maybe', remarks: null }] }).success, false);
  assert.equal(assessmentPayloadSchema.safeParse({ ...valid, building: { id: U } }).success, true);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run test`
Expected: FAIL, cannot find `./access`; `assessmentPayloadSchema` undefined.

- [ ] **Step 3: Implement**

Write `access.ts`, `server-auth.ts`, `getAccessToken` (`supabase.auth.getSession()` → `session?.access_token ?? null`) and the two schemas.

- [ ] **Step 4: Run tests and type-check**

Run: `npm run test && npm run type-check`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
npm run lint:fix
git add src/lib/access.ts src/lib/access.test.ts src/lib/server-auth.ts src/lib/supabase.ts src/lib/schemas.ts src/lib/schemas.test.ts
git commit -m "feat(assessment): access rule, caller check and payload schema"
```

---

### Task 6: Draft model

**Files:**

- Create: `src/lib/assessment-draft.ts`, `src/lib/assessment-draft.test.ts`

**Interfaces (produces):**

```ts
export type DraftStep = 'details' | 'building' | `section:${string}` | 'review';
export interface DraftAnswer { answer?: AnswerValue; remarks?: string }
export interface AssessmentDraft {
  version: 1;
  client_ref: string; evaluator_id: string; campus_id: string; template_version_id: string;
  started_at: string; updated_at: number;
  cluster_id: string; unit_id: string;
  building_id: string; new_building_name: string; building_name: string; // building_id '' while adding one
  incident_commander: string; event_id: string; // '' = none
  floor_count: number; area_type_ids: string[];
  prefilled_from: string | null; // ISO date of the building's last assessment
  answers: Record<string, DraftAnswer>; // by item id, kept when set aside
  comments: Record<string, string>; // by section id
  step: DraftStep;
}
export function newUuid(): string; // crypto.randomUUID when available, else v4 from crypto.getRandomValues (plain-http LAN dev has no randomUUID)
export function newDraft(input: { client_ref: string; evaluator_id: string; campus_id: string; template_version_id: string; cluster_id: string; unit_id: string; now: Date }): AssessmentDraft; // floors 1, no areas, step 'details'
export function clampFloors(value: number): number; // Math.round, then 1..200; NaN → 1
export function applyBuildingProfile(draft: AssessmentDraft, building: BuildingOption): AssessmentDraft; // building_id/name, floor_count, area_type_ids, prefilled_from = last_assessed_at; answers untouched; new_building_name ''
export function setAsideCount(template: AssessmentTemplate, draft: AssessmentDraft, next: { floor_count: number; area_type_ids: string[] }): number; // answered items that apply now but not after
export function draftSteps(template: AssessmentTemplate, draft: AssessmentDraft): DraftStep[];
export function sectionProgress(template: AssessmentTemplate, draft: AssessmentDraft): Record<string, { answered: number; total: number }>; // applicable scored items, by section id
export function toPayload(template: AssessmentTemplate, draft: AssessmentDraft, endedAt: Date): AssessmentPayload;
```

`BuildingOption` (add to `assessment-template.ts` now; Task 7 returns it):

```ts
{ id: string; unit_id: string; name: string; floor_count: number; area_type_ids: string[]; last_assessed_at: string | null }
```

`toPayload` behaviour:

- **Answers:** applicable items only, in template order. A row needs an answer (scored items) or non-empty trimmed remarks. Group parents send `answer: null`.
- **Comments:** applicable sections only, trimmed, non-empty.
- **Building:** `building_id ? { id } : { new: { unit_id, name: trimmed } }`.
- **Event:** `event_id || null`.
- **Times:** `ended_at = endedAt.toISOString()`.

- [ ] **Step 1: Write the failing test, `src/lib/assessment-draft.test.ts`**

```ts
import { MATATAG_2025_07_25 } from '../../prisma/data/matatag-2025-07-25';
import { applyBuildingProfile, clampFloors, draftSteps, newDraft, newUuid, sectionProgress, setAsideCount, toPayload, type AssessmentDraft } from './assessment-draft';
import { templateFromData } from './assessment-template';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const T = templateFromData(MATATAG_2025_07_25);
const id = (label: string) => label.replace('.', '/');
const draft = (patch: Partial<AssessmentDraft> = {}): AssessmentDraft => ({
  ...newDraft({ client_ref: newUuid(), evaluator_id: 'u1', campus_id: 'c1', template_version_id: T.version_id, cluster_id: 'k1', unit_id: 'unit1', now: new Date('2026-10-20T01:00:00Z') }),
  ...patch,
});

test('floors clamp to a whole number from 1 to 200', () => {
  assert.deepEqual([clampFloors(0), clampFloors(Number.NaN), clampFloors(2.6), clampFloors(500)], [1, 1, 3, 200]);
});

test('unticking an area sets its answers aside; ticking it again brings them back', () => {
  const d = draft({ floor_count: 4, area_type_ids: ['laboratories'], answers: { [id('XIII.1')]: { answer: 'yes' }, [id('V.5.5')]: { answer: 'no' }, [id('II.1')]: { answer: 'yes' } } });
  assert.equal(setAsideCount(T, d, { floor_count: 4, area_type_ids: [] }), 2);
  const unticked = { ...d, area_type_ids: [] };
  assert.deepEqual(toPayload(T, unticked, new Date()).answers.map((a) => a.item_id), [id('II.1')]);
  assert.equal(Object.keys(unticked.answers).length, 3);
  assert.equal(sectionProgress(T, d)['XIII'].answered, 1);
});

test('floors 4 → 2 sets the sprinkler answers aside', () => {
  const d = draft({ floor_count: 4, area_type_ids: ['corridors'], answers: { [id('V.6.1')]: { answer: 'yes' } } });
  assert.equal(setAsideCount(T, d, { floor_count: 2, area_type_ids: ['corridors'] }), 1);
});

test('toPayload: new building, no event, group remarks, comments, evaluator', () => {
  const d = draft({ building_id: '', new_building_name: '  Annex  ', area_type_ids: ['bathrooms'], answers: { 'III/2': { remarks: 'Hinges loose' }, [id('XIII.1')]: { answer: 'no' } }, comments: { II: '  ', III: 'Check doors', XIII: 'x' } });
  const p = toPayload(T, d, new Date('2026-10-20T02:00:00Z'));
  assert.deepEqual(p.building, { new: { unit_id: 'unit1', name: 'Annex' } });
  assert.equal(p.event_id, null);
  assert.deepEqual(p.answers, [{ item_id: 'III/2', answer: null, remarks: 'Hinges loose' }]);
  assert.deepEqual(p.comments, [{ section_id: 'III', comment: 'Check doors' }]);
  assert.equal(p.ended_at, '2026-10-20T02:00:00.000Z');
  assert.equal(p.evaluator_id, 'u1');
});

test('choosing a building takes its saved profile and keeps the answers', () => {
  const d = draft({ answers: { [id('II.1')]: { answer: 'yes' } } });
  const next = applyBuildingProfile(d, { id: 'b1', unit_id: 'unit1', name: 'Main', floor_count: 4, area_type_ids: ['offices'], last_assessed_at: '2026-01-05T00:00:00.000Z' });
  assert.deepEqual([next.building_id, next.building_name, next.floor_count, next.prefilled_from], ['b1', 'Main', 4, '2026-01-05T00:00:00.000Z']);
  assert.deepEqual(next.area_type_ids, ['offices']);
  assert.deepEqual(next.answers, d.answers);
});

test('steps skip sections with nothing to ask', () => {
  assert.deepEqual(draftSteps(T, draft()), ['details', 'building', 'section:I', 'section:II', 'section:III', 'section:IV', 'section:V', 'section:VI', 'section:VIII', 'section:X', 'review']);
});

test('newUuid is a v4 uuid', () => {
  assert.match(newUuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm run test`
Expected: FAIL, cannot find `./assessment-draft`.

- [ ] **Step 3: Implement `src/lib/assessment-draft.ts`**

Use the signatures above, reusing `applicableItems` from Task 4.

- [ ] **Step 4: Run the tests**

Run: `npm run test`
Expected: PASS, all suites.

- [ ] **Step 5: Commit**

```bash
npm run lint:fix
git add src/lib/assessment-draft.ts src/lib/assessment-draft.test.ts src/lib/assessment-template.ts
git commit -m "feat(assessment): draft model and payload"
```

---

### Task 7: Server actions

**Files:**

- Create: `src/actions/assessments/index.ts`
- Modify: `src/lib/assessment-template.ts` (result types)

**Interfaces (produces):**

```ts
// src/lib/assessment-template.ts
export interface AssessmentSetup {
  clusters: { id: string; name: string; units: { id: string; name: string }[] }[]; // active, by name
  buildings: BuildingOption[]; // active buildings of the campus
  events: { id: string; name: string; status: string }[]; // ongoing, or completed with ended_at in the last 30 days
}
export type CreateAssessmentResult = { ok: true; id: string } | { ok: false; error: string; retry: boolean };
export interface MyAssessmentRow { id: string; building_name: string; unit_name: string; ended_at: string; safe: number; counted: number; needs_follow_up: boolean }
export interface AssessmentRecord {
  id: string; building_name: string; unit_name: string; cluster_name: string; campus_name: string;
  evaluator_name: string; incident_commander: string; event_name: string | null;
  started_at: string; ended_at: string; floor_count: number; area_type_ids: string[]; needs_follow_up: boolean;
  answers: Record<string, { answer: AnswerValue | null; remarks: string | null }>;
  comments: Record<string, string>;
  template: AssessmentTemplate; // the version it was answered with
}

// src/actions/assessments/index.ts ('use server')
export async function getPublishedTemplate(): Promise<AssessmentTemplate | null>;
export async function getTemplateVersion(versionId: string): Promise<AssessmentTemplate | null>;
export async function getAssessmentSetup(campusId: string): Promise<AssessmentSetup>;
export async function createAssessment(token: string | null, payload: AssessmentPayload): Promise<CreateAssessmentResult>;
export async function getMyAssessments(token: string | null): Promise<MyAssessmentRow[]>; // newest first, 50; [] when the check fails
export async function getMyAssessment(token: string | null, id: string): Promise<AssessmentRecord | null>; // own only
```

Dates leave the server as ISO strings.

**`createAssessment` runs in this order** and returns at the first failure:

1. `requireProfile(token)`:
   - `signed_out` → `{ ok: false, error: 'Sign in again to send this assessment.', retry: true }`
   - other failures → `{ ok: false, error: 'Your account can't submit assessments.', retry: false }`.
2. `!canUseAssessment(profile)` → the same "can't submit" error, `retry: false`. `profile.campus_id` null → "Your profile has no campus yet.", `retry: false`.
3. `payload.evaluator_id !== profile.id` → `{ ok: false, error: 'This assessment belongs to another account. It sends when that account signs in on this phone.', retry: true }`.
4. `assessmentPayloadSchema.safeParse` fails → the first issue's message, `retry: false`.
5. An assessment with this `client_ref` exists → `{ ok: true, id }`.
6. Load the version by id. It must exist and not be `draft` (else "This checklist version can't take new assessments."). Every `area_type_id` must exist.
7. `prepareAssessmentWrite`. `missing > 0` → `` `${missing} questions still need an answer.` ``
8. Resolve the building:
   - `{ id }` must be active, with `unit.cluster.campus_id === profile.campus_id`; else "That building is no longer available."
   - `{ new }`: the unit must be active and in the caller's campus. Find it case-insensitively by (`unit_id`, `name`), or create it with `created_by`. On P2002, find again.
9. `event_id`: keep it only if that event's `campus_id === profile.campus_id`, else `null`.
10. One `prisma.$transaction`:
    - Create the assessment, with nested `areas`, `answers`, `comments` and four `pillar_scores` (pillar ids looked up by code; zeros allowed), `evaluator_id = profile.id` and `needs_follow_up`.
    - Replace `building_areas` with the payload's areas.
    - Set `buildings.floor_count`.
    - A P2002 on `client_ref` → read the existing id and return it.
11. `revalidatePath('/assessments')`, then `{ ok: true, id }`.

Unexpected errors still go through `toFriendlyError(err, 'assessment')` and are thrown.

- [ ] **Step 1: Implement the result types and the actions**

`getPublishedTemplate` and `getTemplateVersion` share one private `loadTemplate(where)`. It loads the version with its sections, items (with `pillar.code`) ordered by `sort_order`, and the active area types, then maps them to `AssessmentTemplate`.

- [ ] **Step 2: Lint and type-check**

Run: `npm run lint && npm run type-check`
Expected: no errors.

- [ ] **Step 3: Read actions against the test database**

Write a scratchpad script that imports `@/actions/assessments` and prints three things:

- `getPublishedTemplate()`: label, section count, scored count
- `getTemplateVersion(sameId)?.label`
- `getAssessmentSetup(<this campus id>)`: clusters with their unit counts.

Get the campus id by printing `prisma.campus.findMany()` in the same script.

Run: `npx tsx --tsconfig tsconfig.json --env-file=.env.development.local <scratchpad>/check-actions.ts`
Expected: `Ver. July 25, 2025 17 211`, the same label again, and the campus's clusters with unit counts. The `createAssessment` paths are exercised through the UI in Task 14.

- [ ] **Step 4: Commit**

```bash
npm run lint:fix
git add src/actions/assessments src/lib/assessment-template.ts
git commit -m "feat(assessment): assessment server actions with caller check"
```

---

### Task 8: Offline storage, queue flush, hooks

**Files:**

- Modify: `src/lib/offline-queue.ts`, `src/components/pwa/offline-queue-provider.tsx`, `src/app/(ert)/report/_components/report-form.tsx` (pending-count line only)
- Create: `src/components/hooks/use-assessments.ts`

**Interfaces:**

- Consumes: Tasks 5–7.
- Produces (`src/lib/offline-queue.ts`):

```ts
// DB_VERSION 3; stores 'assessments' (keyPath id), 'assessment-drafts' (keyPath client_ref), 'assessment-cache' (keyPath key)
export type QueuedAssessment = QueuedEntry<AssessmentPayload>;
export const queueAssessment, getQueuedAssessments, getQueuedAssessmentCount, removeQueuedAssessment, markQueuedAssessmentFailed; // makeQueue
export async function getAllQueuedCount(): Promise<number>; // pending bystander + field + assessments
export async function saveAssessmentDraft(draft: AssessmentDraft): Promise<void>;
export async function getAssessmentDraft(clientRef: string): Promise<AssessmentDraft | undefined>;
export async function getAssessmentDrafts(): Promise<AssessmentDraft[]>;
export async function deleteAssessmentDraft(clientRef: string): Promise<void>;
export async function putAssessmentCache<T>(key: string, value: T): Promise<void>; // stores { key, value, savedAt }
export async function getAssessmentCache<T>(key: string): Promise<T | undefined>;
```

- Produces (`src/components/hooks/use-assessments.ts`):

```ts
export function useAssessmentTemplate(): UseQueryResult<AssessmentTemplate | null>; // ['assessment-template']; caches 'template:published' + `template:${version_id}`
export function useTemplateVersion(versionId?: string): UseQueryResult<AssessmentTemplate | null>; // ['assessment-template-version', id]; cache `template:${id}`
export function useAssessmentSetup(campusId?: string): UseQueryResult<AssessmentSetup>; // ['assessment-setup', campusId]; cache `setup:${campusId}`
export function useAssessmentDrafts(evaluatorId?: string): UseQueryResult<AssessmentDraft[]>; // ['assessment-drafts', id]; IndexedDB only; newest updated_at first
export function useMyAssessments(userId?: string): UseQueryResult<MyAssessmentRow[]>; // ['my-assessments', userId]
export function useMyAssessment(id?: string): UseQueryResult<AssessmentRecord | null>; // ['my-assessment', id]
export function useSubmitAssessment(): UseMutationResult<{ status: 'sent'; id: string } | { status: 'queued' }, Error, { template: AssessmentTemplate; draft: AssessmentDraft }>;
```

How the hooks behave:

- **Offline cache:** the three cached queries use `networkMode: 'always'` and one private helper, `withOfflineCache(key, fetcher)`. Offline (`!navigator.onLine`), it reads the cache. Online, it fetches, writes the cache and returns. On `isNetworkError`, it falls back to the cache. With no cache, it rethrows.
- **`useAssessmentDrafts`** also uses `networkMode: 'always'`.
- **`useSubmitAssessment`** (`networkMode: 'always'`):
  1. `payload = toPayload(template, draft, new Date())`.
  2. Offline → queue it with the summary `{ title: draft.building_name || 'Building assessment', subtitle: 'Assessment · ' + formatted date }`, delete the draft, return `queued`.
  3. Online → `createAssessment(await getAccessToken(), payload)`:
     - `isNetworkError` thrown → queue as above
     - `{ ok: false, retry: true }` → queue
     - `{ ok: false, retry: false }` → throw `new Error(error)`
     - ok → delete the draft and return `sent`.
  4. `onSuccess` invalidates `['my-assessments']`, `['assessment-drafts']` and `['assessment-setup']`, then sets `pendingCount` from `getAllQueuedCount()`.
- **Provider:**
  - Add a third `flushOne`, whose submit calls `createAssessment(await getAccessToken(), payload)`: `ok` → return; `retry` → `throw new TypeError(error)`, so `isNetworkError` keeps it pending; otherwise `throw new Error(error)`.
  - On assessments synced: toast `'1 offline assessment submitted'` / `` `${n} offline assessments submitted` `` and invalidate `['my-assessments']`.
  - `refreshCount` uses `getAllQueuedCount()`.
- **Report form:** `saveOffline` sets the count with `getAllQueuedCount()`.

- [ ] **Step 1: Extend `offline-queue.ts`**

Bump to v3. `onupgradeneeded` creates each missing store with its keyPath. Add a small private `makeKeyValueStore(storeName)` for drafts and cache.

- [ ] **Step 2: Update the provider and the report-form count**

- [ ] **Step 3: Write `use-assessments.ts`**

- [ ] **Step 4: Lint and type-check**

Run: `npm run lint && npm run type-check && npm run test`
Expected: no errors; tests still pass.

- [ ] **Step 5: Commit**

```bash
npm run lint:fix
git add src/lib/offline-queue.ts src/components/pwa/offline-queue-provider.tsx "src/app/(ert)/report/_components/report-form.tsx" src/components/hooks/use-assessments.ts
git commit -m "feat(assessment): offline drafts, cache and queue"
```

---

### Task 9: ERT entry: shared chrome, `/home`, top-bar switch, redirects

**Files:**

- Move (`git mv`) from `src/app/(ert)/report/_components/` to `src/app/(ert)/_components/`: `frame.tsx`, `chrome.tsx`, `top-bar.tsx`, `waiting-to-send.tsx`
- Move from `src/app/(ert)/report/_lib/` to `src/app/(ert)/_lib/`: `format.ts`, `use-field-queue.ts`
- Modify imports in:
  - `report/page.tsx`
  - `report/_components/event-drawer.tsx`
  - `location-section.tsx`
  - `notice-screens.tsx`
  - `report-form.tsx`
  - `submitted-report.tsx`
  - the moved files themselves.
- Modify: `src/components/auth/protected-route.tsx` (`'ERT Member'` and `Bystander` → `'/home'`), `src/app/auth/callback/page.tsx` (non-admin → `'/home'`)
- Create: `src/app/(ert)/_lib/use-ert-access.ts`, `src/app/(ert)/_lib/use-assessment-queue.ts`, `src/app/(ert)/home/page.tsx`

**Interfaces (produces):**

```ts
// src/app/(ert)/_lib/use-ert-access.ts
export type ErtProfile = NonNullable<ReturnType<typeof useAuthStore.getState>['userProfile']>;
/** Signed out → /signin, admin → /dashboard, and with requireAssessment, !canUseAssessment → /home. */
export function useErtAccess(options?: { requireAssessment?: boolean }): { status: 'checking' } | { status: 'setup' } | { status: 'ready'; profile: ErtProfile };
// src/app/(ert)/_lib/use-assessment-queue.ts: same shape as useFieldQueue
export function useQueuedAssessments(): QueuedAssessment[];
// src/app/(ert)/_lib/format.ts: add
export function formatDate(value: Date | string | number): string; // "Oct 8, 2026"
```

**UI:**

- **`TopBar`:**
  - The logo and name become a `Link` to `/home`.
  - When `canUseAssessment(userProfile)`, a two-link switch "Report" (`/report`) | "Assessment" (`/assessment`) shows, with the active one from `usePathname()` and `aria-current="page"`. It sits inline after the name from `md`, and as a full-width row under the bar on phone, with 44px targets. It uses the `SegmentedControl` look but is links, not radios.
- **`/home`** (`useErtAccess()`; `setup` → `<ProfileSetup />`):
  - A `Hero` with the campus eyebrow and the title "What would you like to do?".
  - Two cards (`Card` from chrome), each a full-card link:
    - **Status report:** "Event ongoing — report due" (an ongoing event and no report), "Report sent" (`useMyReport` has data) or "No ongoing event". Uses `useOngoingEvents` + `useMyReport`.
    - **Assessment** (only when `canUseAssessment`): "{n} drafts on this phone", else "Last: {building}, {date}" from `useMyAssessments()[0]`, else "Check a building with the MATATAG checklist".

- [ ] **Step 1: Move the files and fix the imports**

Run: `git mv` for the six files, then update the import paths.
Check: `npm run type-check`, expecting no errors.

- [ ] **Step 2: Add `formatDate`, `useErtAccess`, `useQueuedAssessments`**

- [ ] **Step 3: Top-bar switch, `/home`, redirects**

- [ ] **Step 4: Verify**

Run: `npm run lint && npm run type-check && npm run build`
Expected: no errors; the build lists `/home`.

Manual check (`npm run dev`, signed in as an ERT member):

- sign-in lands on `/home`
- both cards show
- the switch moves between `/report` and `/assessment`; `/assessment` is still a 404 until Task 11
- an Administrator still lands on `/dashboard`
- 320 px: no horizontal scroll.

- [ ] **Step 5: Commit**

```bash
npm run lint:fix
git add -A "src/app/(ert)" src/components/auth/protected-route.tsx src/app/auth/callback/page.tsx
git commit -m "feat(assessment): ERT home chooser and Report | Assessment switch"
```

---

### Task 10: Question language

**Files:**

- Create: `src/lib/question-language.ts`, `src/store/question-language.store.ts`, `src/components/assessment/bilingual.tsx`, `src/components/assessment/question-language-setting.tsx`
- Modify: `src/store/index.ts` (export), `src/components/auth/profile-drawer.tsx` (render the setting after `<AppearanceSetting />`)

**Interfaces (produces):**

```ts
export type QuestionLanguage = 'both' | 'en' | 'fil';
export const QUESTION_LANGUAGE_KEY = 'irs-question-language';
export function readQuestionLanguage(): QuestionLanguage; // 'both' when unset or storage is blocked
export const useQuestionLanguageStore: UseBoundStore<{ language: QuestionLanguage; setLanguage: (l: QuestionLanguage) => void }>; // mirrors useThemeStore
export function Bilingual(props: { en: string; fil: string; as?: 'span' | 'p' | 'h2' | 'h3'; className?: string }): JSX.Element;
export function QuestionLanguageSetting(): JSX.Element;
```

- **`Bilingual`:**
  - `both`: the English text, then the Filipino text on its own line in `text-gray-500` at about 0.9em, with `lang="fil"`.
  - `en`: English only.
  - `fil`: Filipino only, falling back to English when it's empty.
- **`QuestionLanguageSetting`:** the `AppearanceSetting` layout, with the heading "Checklist language" and a `SegmentedControl` of "English + Filipino" / "English" / "Filipino".

- [ ] **Step 1: Implement the four files and the two modifications**

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run type-check`
Expected: no errors.

Manual: My profile shows "Checklist language" under Appearance. The choice survives a reload, and at 320 px the three options don't overflow (they may wrap).

- [ ] **Step 3: Commit**

```bash
npm run lint:fix
git add src/lib/question-language.ts src/store src/components/assessment src/components/auth/profile-drawer.tsx
git commit -m "feat(assessment): checklist language preference"
```

---

### Task 11: `/assessment` route: hub and read-only view

**Files:**

- Create:
  - `src/app/(ert)/assessment/page.tsx`
  - `_components/assessment-hub.tsx`
  - `_components/assessment-view.tsx`
  - `_components/score-summary.tsx`
  - `_components/assessment-stepper.tsx` (a placeholder that Task 12 fills)

**Interfaces (produces):**

```tsx
// page.tsx: Suspense around useSearchParams (as in (admin)/events/details/page.tsx)
// ?view=<id> → <AssessmentView id />, ?draft=<client_ref> → <AssessmentStepper clientRef />, else <AssessmentHub />
export function AssessmentHub(): JSX.Element;
export function AssessmentView(props: { id: string }): JSX.Element;
export function AssessmentStepper(props: { clientRef: string }): JSX.Element;
// score-summary.tsx: used by the view and by the review step
export function ScoreSummary(props: { score: AssessmentScore; template: AssessmentTemplate }): JSX.Element; // overall % + "x of y safe"; Prevention / Preparedness / Response % with PILLARS icon + label; Recovery as "Public Service Continuity Plan: In place / Missing / N/A"; "Needs structural follow-up" Banner (tone warning) when flagged; per-section table (code, title via Bilingual, %, x of y)
```

The page uses `useErtAccess({ requireAssessment: true })` and wraps every state in `ErtFrame`.

**The hub** (title "Building assessment"):

- **Start new assessment** (primary button):
  - Needs `useAssessmentTemplate()` and `useAssessmentSetup(profile.campus_id)`, from the server or the cache. With neither (first open while offline), it shows a `NoticeCard`: "The checklist needs a connection the first time it opens. It loads here as soon as you're back online."
  - On click: `newDraft` with:
    - `newUuid()`
    - `cluster_id: profile.cluster_id ?? profile.unit?.cluster_id ?? ''` (as `ErtReportForm` does) and `unit_id: profile.unit_id ?? ''`
    - the published version id.

    Then `saveAssessmentDraft` → `router.push('/assessment?draft=' + ref)`.
- **On this phone:** `useAssessmentDrafts(profile.id)`. Each row shows the building name (or "New building"), "{answered} of {total} answered" and "Edited {formatDateTime}", with Continue / Discard. Discard asks first, in a `Drawer` with "Discard this draft? Its answers can't be recovered.", then `deleteAssessmentDraft`.
- **Waiting to send:** `useQueuedAssessments()` filtered to `payload.evaluator_id === profile.id`. A pending entry shows a status pill ("Waiting for connection" / "Sending…" / "Waiting to retry"). A failed one shows its error and a Discard, behind the same kind of confirm.
- **Submitted:** `useMyAssessments(profile.id)`. Each row shows the building, the unit, `formatDate(ended_at)` and the overall % (`percent`), and opens `?view=`. Offline with no data: "Connect to see your submitted assessments."

**The view:**

- `useMyAssessment(id)`. `null` → "This assessment isn't available."
- **Header:** `Hero` with the building name and date, then a `DetailList` with building, unit, cluster, evaluator, incident commander, linked event, start and end time, and floors.
- **Scores:** `ScoreSummary`, from `scoreAssessment(record.template, floor_count, area_type_ids, answers)`.
- **Sections:** every applicable section, with each item's answer and remarks and the section comment.
  - An unsafe answer gets an `error`-tone pill.
  - Areas that weren't ticked are listed once as "Not applicable (no {area names})".
- A Back link to `/assessment`.

- [ ] **Step 1: Implement the page, hub, view and score summary (stepper as a placeholder)**

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run type-check`
Expected: no errors.

Manual:

- `/assessment` shows the hub
- Start new creates a draft, opens `?draft=…` (the placeholder), and the draft is listed after going back
- Discard asks first
- signed in as an Administrator → `/dashboard`.

- [ ] **Step 3: Commit**

```bash
npm run lint:fix
git add "src/app/(ert)/assessment"
git commit -m "feat(assessment): assessment hub and read-only view"
```

---

### Task 12: Stepper, pre-screen and section index

**Files:**

- Modify: `src/app/(ert)/assessment/_components/assessment-stepper.tsx`
- Create: `_components/details-step.tsx`, `_components/building-step.tsx`, `_components/section-index.tsx`

**Interfaces (produces):**

```tsx
export function AssessmentStepper(props: { clientRef: string }): JSX.Element;
// Each step gets the draft and an updater; the stepper owns state and autosave.
type StepProps = { template: AssessmentTemplate; draft: AssessmentDraft; update: (fn: (d: AssessmentDraft) => AssessmentDraft) => void };
export function DetailsStep(props: StepProps & { setup: AssessmentSetup; profile: ErtProfile; onValidChange: (valid: boolean) => void }): JSX.Element;
export function BuildingStep(props: StepProps): JSX.Element;
export function SectionIndex(props: { template: AssessmentTemplate; draft: AssessmentDraft; steps: DraftStep[]; current: DraftStep; grown: Set<string>; onOpen: (step: DraftStep) => void }): JSX.Element;
```

**Stepper:**

- **Loading:**
  - The draft comes from `getAssessmentDraft(clientRef)`. Not found, or owned by another `evaluator_id` → "This draft isn't on this phone", with a link to the hub.
  - The template comes from `useTemplateVersion(draft.template_version_id)`, and the setup from `useAssessmentSetup(draft.campus_id)`.
- **State:** the draft lives in state. `update` sets `updated_at = Date.now()`.
- **Autosave:** `saveAssessmentDraft` 500 ms after the last change. A pending save is flushed on `pagehide`, on `visibilitychange` → hidden, and on unmount.
- **Navigation:**
  - Steps come from `draftSteps`, and the current step is `draft.step`. Back / Next sit in a bottom bar (`data-bottom-bar`, sticky, `bg-surface`, `border-line`), and scroll to the top.
  - Next on Details is disabled until the details are valid.
  - If the current step stops existing (its section was screened out), go to `building`.
- **Index:** a "Questions" button in the bar opens `SectionIndex` in the ds `Drawer` (a bottom sheet on phone). From `lg`, the index is also a sticky side list beside the step.
- **Hero:** the building name (or "New assessment"), with "Step k of n" as the eyebrow.

**Details step** (react-hook-form + `zodResolver(assessmentDetailsSchema)`, default values from the draft):

- **Fields, in order:**
  - Campus: read-only text.
  - Cluster: `SelectField` over `setup.clusters`. Changing it clears the unit and the building.
  - College / Department / Unit: required, the cluster's units.
  - Building: the unit's buildings, then "Add a building…". Adding shows a `TextInput` "Building name". If the typed name equals an existing building of the unit (case-insensitive), that building is selected instead, with the help text "Already listed — selected it".
  - Incident Commander: `TextInput`.
  - Linked event / drill: optional; "None" plus `setup.events`.
  - Evaluator, Date and Time start: a read-only `DetailList`.
- **Syncing:** `watch` writes every change into the draft. Choosing an existing building calls `applyBuildingProfile` with that `BuildingOption`.

**Building step:**

- **Floors:** "How many floors?", using the ds `Stepper` with values passed through `clampFloors`.
- **Auto-tick:** going from below 2 floors to 2 or more ticks `stairwells` if it's unticked. Nothing auto-unticks.
- **Areas:** "Which of these does the building have?" is one `SwitchField` per area type, in `sort_order`, with `Bilingual` names. Each description is "{n} questions" from `areaQuestionCounts(template, floors)`.
- **Total:** "{applicable scored count} questions" under the list, live.
- **Prefill note:** with `prefilled_from`, a `Banner tone="warning"` "From the last assessment on {formatDate} — check it's still right". `Banner` has only `error` and `warning` tones.
- **Setting answers aside:**
  - Before unticking an area, or changing floors so `setAsideCount > 0`, a `Drawer` asks first.
  - Area copy: "{n} answers for {Area} will be set aside. They come back if you tick it again."
  - Floors copy: "{n} sprinkler answers will be set aside. They come back if you set 3 or more floors again."
  - Buttons: Keep (`outline`) and Set aside (primary).
  - Answers are never deleted.
- **Grown sections:** when an area is ticked, every section whose total grew goes into the stepper's `grown` set (in memory). The index shows a "New questions" pill on it until it's opened.

**Section index:** one row per step:

- Details
- About the building
- "{code} · {Bilingual title}" with "{answered}/{total}" from `sectionProgress`, and a check when complete
- Review.

The current step is marked `aria-current="step"`.

- [ ] **Step 1: Implement the stepper shell, both pre-screen steps and the index**

Section steps render a placeholder until Task 13.

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run type-check && npm run test`
Expected: no errors.

Manual:

- Start new → Details: cluster, unit and building cascade; add a building by name; Next becomes enabled.
- About the building: floors 2 ticks Stairwells, and the totals read **93** for corridors + bathrooms + offices + stairwells at 2 floors.
- Reload mid-way: the draft is back on the same step.
- Floors 0 or blank → 1.
- 320 px and 1280 px: the side list shows at `lg`.

- [ ] **Step 3: Commit**

```bash
npm run lint:fix
git add "src/app/(ert)/assessment/_components"
git commit -m "feat(assessment): stepper, pre-screen and section index"
```

---

### Task 13: Sections, review and submit

**Files:**

- Create: `_components/section-step.tsx`, `_components/review-step.tsx`
- Modify: `_components/assessment-stepper.tsx` (render them; jump-to-item; submit)

**Interfaces (produces):**

```tsx
export function SectionStep(props: StepProps & { section: TemplateSection }): JSX.Element;
export function ReviewStep(props: StepProps & { onJump: (sectionId: string, itemId: string) => void; onSubmit: () => void; submitting: boolean; error: string }): JSX.Element;
```

**Section step:**

- **Header:** a `SectionCard`-style header with the section code, the `Bilingual` title and "{answered} of {total} answered".
- **Items:** each top-level applicable item renders in template order:
  - **A scored item** is a `Card` (`id="item-{id}"`, `tabIndex={-1}`, `scroll-mt-4`) holding:
    - the `Bilingual` prompt
    - a `SegmentedControl` with Yes / No / N/A (`name="answer-{id}"`, labelled by the prompt)
    - on `safe_answer === 'no'`, the hint "Yes here means a hazard"
    - with a reference, a `<details>` "Reference"
    - an "Add remarks" toggle that opens a `TextArea` (auto-open when remarks exist).
  - **A group parent** is one `Card` showing the shared prompt once, then a row per applicable sub-item (the `Bilingual` sub-item label, its own Yes / No / N/A and remarks toggle), then the group's own remarks toggle.
- **Section comment** at the bottom: a `TextArea` "Comments on this section (optional)".
- **Writes:** every change goes through `update`, into `draft.answers[itemId]` / `draft.comments[sectionId]`.

**Review step:**

- **Scores:** `ScoreSummary` from `scoreAssessment(template, draft.floor_count, draft.area_type_ids, answers)`.
- **Unanswered:** grouped by section, "{n} questions still need an answer". Each row is a button that calls `onJump`, which sets `step` to that section, then scrolls the item into view and focuses it once rendered.
- **Submit** is disabled while anything is unanswered. Its label is "Submit assessment" online and "Save to send later" offline (`useOfflineQueueStore.isOnline`). A thrown error shows in a `Banner`.

**Submitting** (`useSubmitAssessment`):

- `sent` → `router.replace('/assessment?view=' + id)`, toast "Assessment submitted".
- `queued` → `router.replace('/assessment')`, toast "Saved on this phone — sends when you're back online".

- [ ] **Step 1: Implement the section and review steps, jump and submit**

- [ ] **Step 2: Verify**

Run: `npm run lint && npm run type-check && npm run test`
Expected: no errors.

Manual, online, on the test database:

1. Fill a 1-floor building with Offices.
2. Answer II.3 No and VI.1.3 Yes.
3. Review shows II.3 counted safe, the "Needs structural follow-up" banner, and pillar tiles whose "x of y" add up to the overall.
4. Submit lands on the view.
5. The hub lists it under Submitted.
6. Answer some Labs items, untick Laboratories (the confirm shows the count), tick it again, and the answers are back.

- [ ] **Step 3: Commit**

```bash
npm run lint:fix
git add "src/app/(ert)/assessment/_components"
git commit -m "feat(assessment): checklist sections, review and submit"
```

---

### Task 14: End-to-end checks and docs

**Files:**

- Modify: `README.md` (feature list + ER diagram: the assessment tables), `CLAUDE.md`
- Modify: `docs/plan/feature/DRRM-015-assessment-form.md`:
  - Status `In Progress`
  - tick Phase 1 tasks
  - Section 5.5: the seed is `npm run seed:matatag`
  - Section 5.7: note `getAssessmentSetup` and the `{ ok, error, retry }` result
  - Section 5.8: note `evaluator_id` in the payload
- Modify: this file (status)

**CLAUDE.md additions** (match its tone):

- **Commands:** `npm run test`, `npm run seed:matatag`, and the `node --env-file=.env.development.local node_modules/prisma/build/index.js db execute --file …` way to apply a manual SQL file in this worktree.
- **Architecture:** an "Assessments (MATATAG)" paragraph:
  - the template versioning
  - `src/lib/assessment-*` as the shared logic
  - `/home` and `/assessment?draft=|view=`
  - the three new IndexedDB stores
  - `requireProfile(token)` for server-side caller checks
  - expected failures returned as `{ ok, error, retry }`
- **Route groups:** list `(ert)/home`.

- [ ] **Step 1: Production build, then offline checks (`npm run build && npm start`; PWA is off in dev)**

1. Online: open `/assessment` once (fills the cache).
2. DevTools offline: start a new assessment, add a new building, answer, submit → "Saved on this phone…", and the hub lists it under Waiting to send.
3. Online again → it sends once (toast), and it's listed under Submitted.
4. Replay check:
   - Queue another offline submit.
   - Before going online, copy its `client_ref`.
   - Go online and let it send, then `flushNow()` again from a "Try sending now".
   - A scratchpad script counting `assessments` with that `client_ref` prints `1`.

- [ ] **Step 2: Access and shared-phone checks**

1. **Administrator:** sign in as an Administrator in the browser, and copy `access_token` from the `localStorage` key `sb-<project ref>-auth-token`. A scratchpad script (run like Task 7 Step 3) calls `createAssessment(token, payload)`:
   - the payload comes from `getPublishedTemplate()`: 1 floor, no areas, every applicable scored item answered `yes`, and a new building named "Access check" in one of the campus's units
   - `evaluator_id` is the signed-in account's profile id.

   Expected: `{ ok: false, error: "Your account can't submit assessments.", retry: false }`. The same script with an ERT member's token and id → `{ ok: true }`. That writes one test assessment to the test database.
2. **Shared phone:** as ERT member A, queue an assessment offline, sign out, sign in as ERT member B, go online. Expected: A's entry stays waiting (`retry`), and B's hub shows neither A's drafts nor A's queue entry. Sign in as A → it sends.
3. **Safety Officer rule:** flip `canUseAssessment` to the Safety Officer rule locally. The `/home` card, the switch, the `/assessment` guard and `createAssessment` all follow. Revert it.

- [ ] **Step 3: Language, theme, sizes**

- Both / English / Filipino change the stepper and the view.
- Light and dark mode.
- 320 / 390 / 900 / 1280 px on `/home`, the hub, every step type and the view: no horizontal scroll, and nothing hidden behind the bottom bar.

- [ ] **Step 4: Full check**

Run: `npm run lint && npm run type-check && npm run test && npm run build`
Expected: all pass.

- [ ] **Step 5: Docs and commit**

```bash
npm run lint:fix
git add README.md CLAUDE.md docs/plan/feature/DRRM-015-assessment-form.md docs/plan/feature/DRRM-015-phase-1-plan.md
git commit -m "docs(assessment): document the MATATAG assessment (phase 1)"
```
