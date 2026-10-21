# DRRM-015 Phase 2: admins see the results, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** `[Done]` (Parts A and B built, checked hands-on and pushed on 2026-10-21)
- **Branch:** `feat/DRRM-015-assessment-form`, in this worktree (`workspaces/drrmh-irs/Form`) only

**Goal:** Administrators and super admins can list and open every submitted building assessment in their campus scope, fix wrong buildings and assessments, and see on the dashboard how the campus, each cluster, unit and building scores per DRRM pillar against the previous assessments.

**Architecture:** Every admin read takes the Supabase access token, verifies it (`requireProfile`) and decides the campus on the server (`adminScope`): an Administrator always gets their own campus, a Super Admin the one asked for or all. The arithmetic (pooling pillar rows, like-for-like change, section scores, most-failed items, A/B comparison, the dashboard's URL state) is pure code in `src/lib/building-safety.ts`, unit-tested; the actions only load rows and call it. The admin pages reuse the ERT read-only view and print page instead of copying them.

**Tech stack:** Next.js 16 (App Router, server actions), Prisma 7, Supabase Auth, TanStack Query 5, Zustand, react-hook-form + Zod 3, `node:test` through `tsx`, hand-built SVG/CSS charts (no chart library).

**Spec:** `docs/plan/feature/DRRM-015-assessment-form.md`, Phase 2 = its Tasks 9, 9b and 10 + docs. Read Sections 4.2, 4.3, 5.6, 5.7, 5.9 (Admin side) and 7 before starting. Phase 1 plan for the conventions: `docs/plan/feature/DRRM-015-phase-1-plan.md`.

**Parts:** **A** = Tasks 1–7 (admin lists, detail, fixing mistakes). Check A hands-on, commit and push, then **B** = Tasks 8–12 (dashboard Building safety).

## Decisions made while planning (check these)

1. **Admin reads live in two new action domains**, not in `src/actions/assessments` (ERT, ~460 lines): `src/actions/assessment-admin` (lists, detail, delete) and `src/actions/building-safety` (dashboard). Both use `requireAdmin` (Task 1).
2. **The template loader and record mapping move** from `src/actions/assessments/index.ts` to `src/lib/assessment-records.ts` (server-only, not `'use server'`), so the admin detail returns the exact `AssessmentRecord` the ERT view already renders.
3. **The admin detail reuses the ERT view's body** (`AssessmentRecordBody`, extracted from `assessment-view.tsx`) and the ERT print page's `RecordPrint` (extracted from `assessment-print.tsx`), imported across route groups the way `(print)/events/report` imports `(admin)/_lib/summary`. Admins print at `/assessments/report?id=` in the `(print)` group.
4. **The Settings → Buildings tab follows the other lookup tables exactly**, including their actions not checking the caller (the generic `actions/settings` trusts the client, like every other lookup table today). Only the assessment reads and the delete check the token.
5. **Inactive buildings** are left out of the dashboard (scores and "Not yet assessed") and of the `/assessments` Buildings tab; their assessments stay in the Assessments tab. Settings → Buildings lists all of them.
6. **Deleting an assessment doesn't rewrite the building's profile** (floors, areas). A wrong floor count is fixed in Settings → Buildings; areas are re-ticked on the next assessment.
7. **"Change" is percentage points**: `percent(after) − percent(before)` using `percent()` from `assessment-score.ts`, `null` when either side has nothing counted. Every change on the dashboard is like-for-like (only buildings that have a previous assessment), including the section table.
8. **Most-failed denominators** are the in-scope buildings whose current assessment answered that item YES or NO; items are matched across checklist versions by their label (`itemLabel`, e.g. `V.4`).
9. **No pagination on the server.** `getAssessmentList` returns the newest 1000 in scope; the page filters and pages on the client like `/reports`.
10. **Test data for the dashboard** comes from a throwaway script in the scratchpad (Task 12), written straight through Prisma with `prepareAssessmentWrite`, into the test database only, after asking.

## Global constraints

- Never run `npx prisma db push`, `prisma migrate dev` or `prisma migrate reset`. Phase 2 needs **no schema change**.
- **Ask the user before** any command that writes to the test database (Task 12's sample data). Test assessments never go to production.
- All DB access goes through `'use server'` functions in `src/actions/<domain>/index.ts`. Components never import Prisma.
- Every admin assessment read takes the campus from the caller's verified profile; only a Super Admin's requested campus is honoured (spec 5.6, 5.7).
- Zod schemas live in `src/lib/schemas.ts`. Forms use react-hook-form + `@hookform/resolvers/zod`.
- Theme tokens only: `bg-canvas` pages, `bg-surface` cards/bars/drawers/inputs, `border-line` hairlines, `bg-brand-solid` maroon fills. No `dark:` variants for gray/brand classes.
- No chart library. Charts are SVG/CSS in `src/app/(admin)/_components/charts/`. **Load the `dataviz` skill before writing any chart or choosing its colours.**
- Don't hand-order imports or Tailwind classes. Run `npm run lint:fix` before each commit.
- Breakpoints: phone is the base, `md` tablet, `lg` web. Check at 320 / 390 / 900 / 1280 px, light and dark.
- Browser checks sign in with the accounts in `test-accounts.local.md` (gitignored); never copy them into committed files.
- Commit messages: `feat(assessment): …` / `fix(assessment): …` / `docs(assessment): …`, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Copy fixed by the spec, used verbatim:
  - "Not yet assessed ({n})"
  - "▲ {n} pts · {k} of {m} buildings re-assessed" (▼ when lower)
  - "{n} of {m} buildings have a Public Service Continuity Plan"
  - "Public Service Continuity Plan: In place / Missing / N/A"
  - "Needs a second assessment to compare"
  - "{label} {prompt} — unsafe in {n} of {m} buildings" (e.g. "V.4 Fire alarms functional and audible — unsafe in 7 of 12 buildings")
  - "Not applicable (no {areas})"

## Review Focus

1. **An Administrator asking for another campus** (a `bs_campus` in a shared URL, or a crafted `campusId`) must still get only their own campus, from every admin action. Pinned by `adminScope` tests (Task 1) and the Task 7 / Task 12 browser checks.
2. **A building assessed once** counts in the current score but not in the change, and the label counts it out of "re-assessed". Pinned by the `poolBuildings` tests (Task 8).
3. **A pillar or section with nothing counted** (all N/A, or the section didn't apply) shows "—" with no change, never 0% or a jump. Pinned by `pointsChange` and `compareScores` tests (Tasks 2, 8).
4. **Bad compare picks in the URL** (A = B, an id from another building, garbage) fall back to the default pair (#n−1 vs #n), and the server refuses a pair from two buildings. Pinned by the `comparePair` tests (Task 8) and the action check (Task 9).
5. **Deleting the only assessment of a building** returns it to "Not yet assessed" everywhere, and a building that still has assessments can't be deleted in Settings (turn it off instead). Pinned by the Task 7 browser check.

---

## File map

| Path                                                                                  | Responsibility                                                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/lib/admin-scope.ts` (+ test)                                                     | `adminScope`: role and campus an admin caller may read                                              |
| `src/lib/server-auth.ts`                                                              | + `requireAdmin(token, requestedCampusId?)`                                                         |
| `src/lib/assessment-records.ts`                                                       | Server-only loaders: template version, `AssessmentRecord`, `BuildingScores` rows                    |
| `src/lib/building-safety.ts` (+ test)                                                 | Pure: pillar rows → scores, change, pooling, children, sections, most-failed, comparison, URL state |
| `src/actions/assessment-admin/index.ts`                                               | `getAssessmentList`, `getBuildingSummaries`, `getAssessment`, `deleteAssessment`                    |
| `src/actions/building-safety/index.ts`                                                | `getSafetyRollup`, `getBuildingHistory`, `compareAssessments`                                       |
| `src/components/hooks/use-assessments.ts`                                             | + admin and dashboard hooks                                                                         |
| `src/app/(admin)/_components/shell/nav.ts`                                            | + Assessments item                                                                                  |
| `src/app/(admin)/assessments/page.tsx` + `_components/`                               | Buildings / Assessments tabs                                                                        |
| `src/app/(admin)/assessments/details/page.tsx`                                        | Read-only detail, Print, Super Admin delete                                                         |
| `src/app/(print)/assessments/report/page.tsx`                                         | Admin A4 print                                                                                      |
| `src/app/(ert)/assessment/_components/assessment-view.tsx`, `assessment-print.tsx`    | Export `AssessmentRecordBody` / `RecordPrint` for reuse                                             |
| `src/app/(admin)/settings/...`, `src/actions/settings/index.ts`, `src/lib/schemas.ts` | Buildings lookup tab                                                                                |
| `src/app/globals.css`                                                                 | + `--series-1` … `--series-6` (light and dark)                                                      |
| `src/app/(admin)/_components/charts/`                                                 | `GroupedBars`, `RowChart`, `LineChart`, `ChangeBadge`                                               |
| `src/app/(admin)/dashboard/_components/building-safety/`                              | The drill-down section                                                                              |

---

## Part A

### Task 1: Admin scope and `requireAdmin`

**Files:**

- Create: `src/lib/admin-scope.ts`, `src/lib/admin-scope.test.ts`
- Modify: `src/lib/server-auth.ts`

**Interfaces:**

- Produces:
  - `type AdminScope = { ok: true; role: 'administrator' | 'super_admin'; campusId: string | null } | { ok: false }` — `campusId: null` means all campuses (Super Admin only).
  - `adminScope(profile: { user_type?: { name: string } | null; campus_id: string | null }, requestedCampusId?: string | null): AdminScope`
  - `inScope(scope: AdminScope & { ok: true }, campusId: string): boolean`
  - `requireAdmin(token: string | null | undefined, requestedCampusId?: string | null): Promise<{ ok: true; profile: VerifiedProfile; scope: AdminScope & { ok: true } } | { ok: false }>` in `server-auth.ts`.

- [x] **Step 1: Write the failing test `src/lib/admin-scope.test.ts`**

```ts
test('an administrator always gets their own campus', () => {
  const admin = { user_type: { name: 'Administrator' }, campus_id: 'own' };
  assert.deepEqual(adminScope(admin), { ok: true, role: 'administrator', campusId: 'own' });
  assert.deepEqual(adminScope(admin, 'other'), {
    ok: true,
    role: 'administrator',
    campusId: 'own',
  });
  assert.deepEqual(adminScope(admin, null), { ok: true, role: 'administrator', campusId: 'own' });
  assert.deepEqual(adminScope({ ...admin, campus_id: null }), { ok: false });
});

test('a super admin gets the campus asked for, or all', () => {
  const sa = { user_type: { name: 'Super Admin' }, campus_id: 'own' };
  assert.deepEqual(adminScope(sa, 'other'), { ok: true, role: 'super_admin', campusId: 'other' });
  assert.deepEqual(adminScope(sa), { ok: true, role: 'super_admin', campusId: null });
  assert.deepEqual(adminScope(sa, ''), { ok: true, role: 'super_admin', campusId: null });
});

test('anyone else is refused', () => {
  for (const name of ['ERT Member', 'Bystander']) {
    assert.deepEqual(adminScope({ user_type: { name }, campus_id: 'own' }), { ok: false });
  }
  assert.deepEqual(adminScope({ user_type: null, campus_id: 'own' }), { ok: false });
});

test('inScope: all campuses or the same one', () => {
  assert.equal(inScope({ ok: true, role: 'super_admin', campusId: null }, 'x'), true);
  assert.equal(inScope({ ok: true, role: 'administrator', campusId: 'a' }, 'a'), true);
  assert.equal(inScope({ ok: true, role: 'administrator', campusId: 'a' }, 'b'), false);
});
```

- [x] **Step 2: Run it to see it fail** — `npm run test` → FAIL, module not found.
- [x] **Step 3: Implement `adminScope` and `inScope`** using `USER_TYPES` / `isAdminUserType` from `src/lib/constants.ts` for the role names.
- [x] **Step 4: Add `requireAdmin` to `server-auth.ts`**: `requireProfile(token)`, then `adminScope(profile, requestedCampusId)`; `{ ok: false }` when either fails.
- [x] **Step 5: Run** `npm run test` and `npm run type-check` → pass.
- [x] **Step 6: Commit** `feat(assessment): admin scope check for assessment reads`

### Task 2: Shared loaders and score helpers

**Files:**

- Create: `src/lib/assessment-records.ts`, `src/lib/building-safety.ts`, `src/lib/building-safety.test.ts`
- Modify: `src/actions/assessments/index.ts` (use the moved loaders; no behaviour change), `src/lib/assessment-template.ts` (+ types below)

**Interfaces:**

- Produces, in `assessment-template.ts`:
  - `interface ScoredAssessment { id: string; ended_at: string; evaluator_name: string; needs_follow_up: boolean; event_name: string | null; overall: Tally; pillars: Record<PillarCode, Tally> }`
  - `interface Named { id: string; name: string }`
  - `interface BuildingScores { id: string; name: string; floor_count: number; unit: Named; cluster: Named; campus: Named; assessment_count: number; latest: ScoredAssessment | null; previous: ScoredAssessment | null }`
  - `interface AdminAssessmentRow { id: string; building: Named; unit: Named; cluster: Named; campus: Named; evaluator_name: string; event_name: string | null; ended_at: string; overall: Tally; needs_follow_up: boolean }`
- Produces, in `assessment-records.ts` (import only from server actions):
  - `loadVersion(where)` — moved as is from the ERT actions.
  - `loadAssessmentRecord(where: Prisma.AssessmentWhereInput): Promise<(AssessmentRecord & { campus_id: string; building_id: string }) | null>` — the body of `getMyAssessment` after its caller check, plus the two ids.
  - `loadBuildingScores(where: Prisma.BuildingWhereInput): Promise<BuildingScores[]>` — buildings ordered by name with `assessments: { orderBy: { ended_at: 'desc' }, take: 2, include pillar_scores (with pillar code), evaluator, event }` and `_count.assessments`.
- Produces, in `building-safety.ts`:
  - `scoresFromPillarRows(rows: { code: string; safe_count: number; counted_count: number; na_count: number }[]): { overall: Tally; pillars: Record<PillarCode, Tally> }` — unknown codes ignored, missing pillars zero.
  - `pointsChange(before: Tally | null | undefined, after: Tally | null | undefined): number | null`

- [x] **Step 1: Write the failing tests in `building-safety.test.ts`**

```ts
test('pillar rows add up to the overall score', () => {
  const s = scoresFromPillarRows([
    { code: 'prevention-mitigation', safe_count: 17, counted_count: 19, na_count: 0 },
    { code: 'preparedness', safe_count: 13, counted_count: 13, na_count: 1 },
    { code: 'response', safe_count: 9, counted_count: 9, na_count: 0 },
    { code: 'rehabilitation-recovery', safe_count: 1, counted_count: 1, na_count: 0 },
  ]);
  assert.deepEqual(s.overall, { safe: 40, counted: 42, na: 1 });
  assert.deepEqual(s.pillars.preparedness, { safe: 13, counted: 13, na: 1 });
  assert.deepEqual(scoresFromPillarRows([]).pillars.response, { safe: 0, counted: 0, na: 0 });
});

test('change is in points, and nothing counted means no change', () => {
  assert.equal(pointsChange({ safe: 5, counted: 10, na: 0 }, { safe: 8, counted: 10, na: 0 }), 30);
  assert.equal(pointsChange({ safe: 8, counted: 10, na: 0 }, { safe: 5, counted: 10, na: 0 }), -30);
  assert.equal(pointsChange(null, { safe: 1, counted: 1, na: 0 }), null);
  assert.equal(pointsChange({ safe: 0, counted: 0, na: 3 }, { safe: 1, counted: 1, na: 0 }), null);
});
```

- [x] **Step 2: Run them to see them fail.**
- [x] **Step 3: Implement both helpers**, then move `loadVersion` and the record mapping into `assessment-records.ts`, add `loadBuildingScores`, and make `getMyAssessment` call `loadAssessmentRecord({ id, evaluator_id: caller.profile.id })`.
- [x] **Step 4: Run** `npm run test`, `npm run type-check`, `npm run lint` → pass. Open one submitted assessment as the ERT test account on `npm run dev`: the view is unchanged.
- [x] **Step 5: Commit** `refactor(assessment): share the record loaders and score helpers`

### Task 3: Admin actions and hooks

**Files:**

- Create: `src/actions/assessment-admin/index.ts`
- Modify: `src/components/hooks/use-assessments.ts`

**Interfaces:**

- Consumes: `requireAdmin`, `inScope` (Task 1); `loadAssessmentRecord`, `loadBuildingScores`, `scoresFromPillarRows` (Task 2).
- Produces (actions):
  - `getAssessmentList(token: string | null, campusId?: string | null): Promise<AdminAssessmentRow[]>` — newest 1000 in scope; `[]` when refused.
  - `getBuildingSummaries(token: string | null, campusId?: string | null): Promise<BuildingScores[]>` — active buildings in scope.
  - `getAssessment(token: string | null, id: string): Promise<AssessmentRecord | null>` — `null` when refused, not found or out of scope.
  - `deleteAssessment(token: string | null, id: string): Promise<{ ok: true } | { ok: false; error: string }>` — Super Admin only (`"Only a super admin can delete an assessment."`); cascades; `revalidatePath('/assessments')` and `revalidatePath('/dashboard')`.
- Produces (hooks; `campusId` from `useScopedCampusId()`, `''` → `null`):
  - `useAssessmentList(campusId)`, query key `['admin-assessments', campusId]`
  - `useBuildingSummaries(campusId)`, key `['building-summaries', campusId]`
  - `useAdminAssessment(id)`, key `['admin-assessment', id]`
  - `useDeleteAssessment()`, invalidates `admin-assessments`, `building-summaries`, `building-safety`, `building-history`
- Scope filter for every query: `building: { unit: { cluster: { campus_id: scope.campusId } } }` when `campusId` is set.

- [x] **Step 1: Implement the four actions** following `getMyAssessments` for the token handling.
- [x] **Step 2: Implement the hooks** following `useMyAssessments` (`await getAccessToken()` inside `queryFn`).
- [x] **Step 3: Run** `npm run type-check` and `npm run lint` → pass. (The actions are checked in the browser in Task 7; reading a session token out of the browser for a script is blocked in this environment.)
- [x] **Step 4: Commit** `feat(assessment): admin assessment reads with the campus lock`

### Task 4: `/assessments` — Buildings and Assessments tabs

**Files:**

- Create: `src/app/(admin)/assessments/page.tsx`, `src/app/(admin)/assessments/_components/buildings-tab.tsx`, `src/app/(admin)/assessments/_components/assessments-tab.tsx`, `src/app/(admin)/_components/charts/change-badge.tsx`
- Modify: `src/app/(admin)/_components/shell/nav.ts`

**Interfaces:**

- Consumes: `useBuildingSummaries`, `useAssessmentList` (Task 3); `percent`, `recoveryStatus` from `assessment-score.ts`; `pointsChange` (Task 2); `PILLARS`.
- Produces: `ChangeBadge({ value }: { value: number | null })` — "▲ 8" green, "▼ 8" red, "0" grey, nothing for `null`. Reused by Part B.

- [x] **Step 1: Nav item.** `{ key: 'assessments', label: 'Assessments', short: 'Assess', href: '/assessments', icon: ClipboardCheck }` after Bystander reports, not a bottom tab.
- [x] **Step 2: The page.** `PageHeader` "Assessments", subtitle "Building safety checklists (MATATAG)"; `ListTabs` Buildings | Assessments kept in `?tab=` (default `buildings`), like `/emergency-reports`.
- [x] **Step 3: Buildings tab.** `DataTable` + `MobileCard`. Columns: Building (name, unit under it), Cluster, Overall, Prevention, Preparedness, Response (each `percent` of `latest` with `ChangeBadge` of `pointsChange(previous, latest)`), PSCP (`recoveryStatus` → In place / Missing / N/A), Last assessed, Evaluator, a "Follow-up" `Chip` when `latest.needs_follow_up`. Buildings without assessments show "Not yet assessed" across the score columns. Search by name; Cluster `FilterSelect`. A row opens its latest assessment (`/assessments/details?id=`).
- [x] **Step 4: Assessments tab.** Columns: Building (+ unit), Cluster, Date (`ended_at`), Evaluator, Event, Overall, Follow-up. Filters: search, Cluster, Unit (narrowed by the cluster), From / To dates on `ended_at`. Client-side `Pager` like `/reports`. Rows open the detail.
- [x] **Step 5: Check** `npm run dev` as the admin test account: both tabs list the Phase 1 test assessments; the campus switcher (super admin) changes both. 390 and 1280 px.
- [x] **Step 6: Commit** `feat(assessment): admin assessments list`

### Task 5: `/assessments/details` and admin print

**Files:**

- Create: `src/app/(admin)/assessments/details/page.tsx`, `src/app/(print)/assessments/report/page.tsx`
- Modify: `src/app/(ert)/assessment/_components/assessment-view.tsx`, `src/app/(ert)/assessment/_components/assessment-print.tsx`

**Interfaces:**

- Consumes: `useAdminAssessment`, `useDeleteAssessment` (Task 3); `useIsSuperAdmin`.
- Produces:
  - `AssessmentRecordBody({ record }: { record: AssessmentRecord })` exported from `assessment-view.tsx`: the details list, Scores (`ScoreSummary`) and Answers (with the "Not applicable (no …)" line) that `RecordView` renders today. `RecordView` keeps its hero, back link and Print button and renders this body.
  - `RecordPrint({ record, back }: { record: AssessmentRecord; back: React.ReactNode })` exported from `assessment-print.tsx`; `AssessmentPrint` passes its ERT back link.

- [x] **Step 1: Extract both components**; the ERT view and print page look and behave the same (check `/assessment?view=` and `?print=` as the ERT account).
- [x] **Step 2: The detail page** (`/assessments/details?id=`, same `Suspense` + `useSearchParams` pattern as `/events/details`): `PageHeader` with the building name, back to `/assessments`, a "Needs follow-up" chip, actions **Print** (opens `/assessments/report?id=` in a new tab, like Export PDF on events) and, for Super Admin only, **Delete**. Body: `AssessmentRecordBody`. Not found / out of scope → "Assessment not found" card like events.
- [x] **Step 3: Delete** behind `ConfirmDialog` (tone `danger`, title "Delete this assessment?", `name` = building and date, body "will be permanently deleted with its answers and scores. This cannot be undone.", confirm "Delete assessment"). On success: toast, `router.push('/assessments')`.
- [x] **Step 4: Admin print page** `/assessments/report?id=`: `useAdminAssessment` → `RecordPrint` with a back link to the detail page.
- [x] **Step 5: Check** as admin and super admin: detail, print (stub `window.print` as in Phase 1), delete hidden for admin; as super admin delete a Phase 1 test assessment (ask the user which one first).
- [x] **Step 6: Commit** `feat(assessment): admin assessment detail, print and delete`

### Task 6: Settings → Buildings (Task 9b)

**Files:**

- Create: `src/app/(admin)/settings/buildings/page.tsx`
- Modify: `src/actions/settings/index.ts`, `src/app/(admin)/settings/_components/settings-page.tsx`, `src/app/(admin)/settings/_components/lookup-table.tsx`, `src/lib/schemas.ts`, `src/components/hooks/use-settings.ts` (if a key needs adding)

**Interfaces:**

- Produces:
  - `SettingsTable` gains `'buildings'`; `MODEL_MAP.buildings = 'building'`; `TITLE_MAP.buildings = 'Buildings'`; `INCLUDE_MAP.buildings = { unit: { select: { name: true, cluster_id: true, cluster: { select: { name: true, campus_id: true } } } }, _count: { select: { assessments: true } } }`.
  - `buildingSchema = z.object({ name: z.string().trim().min(1).max(120), unit_id: z.string().uuid(), floor_count: z.coerce.number().int().min(1).max(200), is_active: z.boolean() })`, messages in the style of `unitSchema`.
  - `LOOKUPS.buildings = { table: 'buildings', label: 'Buildings', singular: 'building', noun: 'buildings' }`.

- [x] **Step 1: Actions and schema.**
- [x] **Step 2: LookupTable for buildings.** Rows filtered to the scoped campus via `unit.cluster.campus_id`; columns Name, Unit (cluster under it), Floors, Created, Active, actions; Cluster `FilterSelect`; `linkedWarning` counts `assessments` too ("… assessments are linked to it. If it can't be deleted, turn it off instead …"). Drawer: Name, Unit (`SelectField`, campus-scoped active units labelled "Unit · Cluster"), Floors (whole number 1–200), Active.
- [x] **Step 3: Check** as admin: rename a building (the new name shows on its assessments), move it to another unit, set floors, turn it off (it disappears from the ERT Details step and from `/assessments` Buildings), try deleting one with assessments (friendly refusal), delete one without (works). Renaming to an existing name in the same unit gives "A building with that value already exists."
- [x] **Step 4: Commit** `feat(assessment): manage buildings in settings`

### Task 7: Part A check, docs, push

- [x] **Step 1:** `npm run lint && npm run type-check && npm run test && npm run build`.
- [x] **Step 2: Hands-on on a production build** (`npm run build`, then `npx next start -p 3100` with `.env.development.local` exported; port 3000 may be taken):
  - Admin: only their campus everywhere; `/assessments?tab=assessments` filters work; detail and print work; no Delete.
  - Super admin: switcher All / one campus changes both tabs; Delete works and the building returns to "Not yet assessed" when it was its only assessment.
  - ERT member: `/assessments` sends them to `/home` (`ProtectedRoute`).
  - 320 / 390 / 900 / 1280 px, light and dark, on both tabs, the detail and Settings → Buildings.
- [x] **Step 3: Docs:** spec Section 6 tick Task 9 and 9b; Section 2 tick "Admin `/assessments` …". CLAUDE.md: admin assessments (actions domain, `requireAdmin`, the Settings → Buildings tab). README feature list: Assessments (admin).
- [x] **Step 4: Commit and push** `docs(assessment): admin assessments (phase 2 part A)`.

---

## Part B

### Task 8: Rollup logic

**Files:**

- Modify: `src/lib/building-safety.ts`, `src/lib/building-safety.test.ts`

**Interfaces:**

- Consumes: `BuildingScores`, `ScoredAssessment`, `Named` (Task 2); `percent`, `recoveryStatus`, `scoreAssessment`, `AssessmentScore`.
- Produces:
  - `type RollupLevel = 'all' | 'campus' | 'cluster' | 'unit'`
  - `interface Pooled { overall: Tally; pillars: Record<PillarCode, Tally> }`
  - `interface RollupGroup { buildings: number; assessed: number; reassessed: number; current: Pooled; likeForLike: { previous: Pooled; current: Pooled } | null; pscp: { has: number; of: number; change: number | null }; lastAssessedAt: string | null }`
  - `poolBuildings(buildings: BuildingScores[]): RollupGroup` — `current` pools every `latest`; `likeForLike` pools `previous` and `latest` of the buildings that have both (`null` when none); `pscp.has` = latest Recovery in place, `pscp.of` = latest Recovery not N/A, `pscp.change` = has among re-assessed now − then (`null` when none re-assessed).
  - `interface ChildRow extends Named, RollupGroup { kind: 'campus' | 'cluster' | 'unit' | 'building' }`
  - `groupChildren(buildings: BuildingScores[], level: RollupLevel): ChildRow[]` — `all`→campus, `campus`→cluster, `cluster`→unit, `unit`→building; sorted by name.
  - `interface AnswerFact { assessment_id: string; section_code: string; section_order: number; section_title_en: string; section_title_fil: string; label: string; prompt_en: string; prompt_fil: string; pillar_code: PillarCode | null; answer: 'yes' | 'no' | 'na'; safe_answer: 'yes' | 'no' }`
  - `interface SectionRow { code: string; title_en: string; title_fil: string; current: Tally; change: number | null }`
  - `sectionScores(facts: AnswerFact[], ids: { current: string[]; lflCurrent: string[]; lflPrevious: string[] }): SectionRow[]` — in `section_order`; `change` from the like-for-like pair.
  - `interface FailedItem { label: string; prompt_en: string; prompt_fil: string; unsafe: number; of: number }`
  - `mostFailed(facts: AnswerFact[], currentIds: string[], perPillar = 5): { pillar: PillarCode; items: FailedItem[] }[]` — per pillar in `PILLAR_CODES` order, items with `unsafe > 0`, sorted by `unsafe` desc then `label`; `of` counts YES/NO answers; pillars with none left out.
  - `interface CompareRow { key: string; title_en: string; title_fil?: string; a: Tally | null; b: Tally | null; change: number | null }`
  - `interface Comparison { overall: CompareRow; pillars: CompareRow[]; sections: CompareRow[]; versionsDiffer: boolean }`
  - `compareScores(a: { template: AssessmentTemplate; score: AssessmentScore }, b: { template: AssessmentTemplate; score: AssessmentScore }): Comparison` — sections matched by `code`, in B's order then A-only ones; a side without the section is `null` and `change` is `null`.
  - `comparePair(historyIds: string[], a?: string | null, b?: string | null): { a: string | null; b: string | null }` — `historyIds` oldest first; defaults to the last two; an unknown id or `a === b` falls back to the default; one assessment → `{ a: null, b: id }`.
  - `interface DashboardScope { campusId: string | null; clusterId: string | null; unitId: string | null; buildingId: string | null; a: string | null; b: string | null }`
  - `scopeFromParams(params: URLSearchParams, opts: { isSuperAdmin: boolean; switcherCampusId: string }): DashboardScope` — reads `bs_campus`, `bs_cluster`, `bs_unit`, `bs_building`, `bs_a`, `bs_b`; an Administrator's `campusId` is always `null` (the server uses their own); a Super Admin's falls back to the switcher (`''` → `null`).

- [x] **Step 1: Write the failing tests** (building fixtures made with a small `building(id, unit, cluster, latest?, previous?)` helper in the test file):

```ts
test('pooled current counts every latest; the change only re-assessed buildings', () => {
  const g = poolBuildings([
    building('A', 'u1', 'c1', s(8, 10), s(5, 10)), // re-assessed: 50% → 80%
    building('B', 'u1', 'c1', s(10, 10)), // assessed once
    building('C', 'u2', 'c1'), // not yet assessed
  ]);
  assert.deepEqual([g.buildings, g.assessed, g.reassessed], [3, 2, 1]);
  assert.deepEqual(g.current.overall, { safe: 18, counted: 20, na: 0 });
  assert.equal(pointsChange(g.likeForLike!.previous.overall, g.likeForLike!.current.overall), 30);
});

test('no re-assessed building: no change at all', () => {
  assert.equal(poolBuildings([building('B', 'u1', 'c1', s(1, 1))]).likeForLike, null);
});

test('a building older assessment never counts toward the tiles', () => {
  const g = poolBuildings([building('A', 'u1', 'c1', s(10, 10), s(0, 10))]);
  assert.deepEqual(g.current.overall, { safe: 10, counted: 10, na: 0 });
});

test('children follow the level', () => {
  const bs = [
    building('A', 'u1', 'c1', s(1, 1)),
    building('B', 'u2', 'c1'),
    building('C', 'u3', 'c2'),
  ];
  assert.deepEqual(
    groupChildren(bs, 'campus').map((c) => [c.kind, c.id, c.buildings]),
    [
      ['cluster', 'c1', 2],
      ['cluster', 'c2', 1],
    ]
  );
  assert.deepEqual(
    groupChildren(bs, 'unit').map((c) => c.kind),
    ['building', 'building', 'building']
  );
});

test('most failed: per pillar, out of the buildings that answered it', () => {
  const facts = [
    fact('a1', 'V.4', 'no'),
    fact('a2', 'V.4', 'no'),
    fact('a3', 'V.4', 'yes'),
    fact('a3', 'II.1', 'na'),
  ];
  const [response] = mostFailed(facts, ['a1', 'a2', 'a3']);
  assert.deepEqual(response.items[0], {
    label: 'V.4',
    prompt_en: 'V.4 en',
    prompt_fil: 'V.4 fil',
    unsafe: 2,
    of: 3,
  });
});

test('compare: a section only in B has no change; different versions are flagged', () => {
  // two templates from templateFromData(MATATAG_2025_07_25); B's version_id changed and Labs ticked
  const c = compareScores(sideA, sideB);
  const labs = c.sections.find((r) => r.key === 'XIII')!;
  assert.equal(labs.a, null);
  assert.equal(labs.change, null);
  assert.equal(c.versionsDiffer, true);
});

test('compare pair: defaults, and bad picks fall back', () => {
  const h = ['n1', 'n2', 'n3', 'n4'];
  assert.deepEqual(comparePair(h), { a: 'n3', b: 'n4' });
  assert.deepEqual(comparePair(h, 'n1', 'n4'), { a: 'n1', b: 'n4' });
  assert.deepEqual(comparePair(h, 'n4', 'n4'), { a: 'n3', b: 'n4' });
  assert.deepEqual(comparePair(h, 'zzz', 'n2'), { a: 'n3', b: 'n2' });
  assert.deepEqual(comparePair(['n1']), { a: null, b: 'n1' });
});

test('an administrator never picks the campus from the URL', () => {
  const p = new URLSearchParams('bs_campus=other&bs_cluster=c1');
  assert.equal(scopeFromParams(p, { isSuperAdmin: false, switcherCampusId: '' }).campusId, null);
  assert.equal(
    scopeFromParams(p, { isSuperAdmin: true, switcherCampusId: 'sw' }).campusId,
    'other'
  );
  assert.equal(
    scopeFromParams(new URLSearchParams(), { isSuperAdmin: true, switcherCampusId: 'sw' }).campusId,
    'sw'
  );
});
```

- [x] **Step 2: Run them to see them fail.**
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** `npm run test` → pass.
- [x] **Step 5: Commit** `feat(assessment): building safety rollup logic`

### Task 9: Dashboard actions and hooks

**Files:**

- Create: `src/actions/building-safety/index.ts`
- Modify: `src/components/hooks/use-assessments.ts`, `src/lib/assessment-template.ts` (+ the result types)

**Interfaces:**

- Consumes: `requireAdmin`, `inScope`; `loadBuildingScores`, `loadAssessmentRecord`; everything in Task 8.
- Produces (actions):
  - `getSafetyRollup(token: string | null, scope: { campusId?: string | null; clusterId?: string | null; unitId?: string | null }): Promise<SafetyRollup | null>` where `SafetyRollup = { level: RollupLevel; trail: { campus?: Named; cluster?: Named; unit?: Named }; group: RollupGroup; children: ChildRow[]; notAssessed: Named[]; sections: SectionRow[]; mostFailed: { pillar: PillarCode; items: FailedItem[] }[] }`. The level is `unit` with a unit id, `cluster` with a cluster id, `campus` with a campus (always for an Administrator), else `all`. The building filter combines the scope's campus with the cluster/unit ids, so ids from another campus return an empty rollup, never its data. `AnswerFact`s come from one `assessmentAnswerRow.findMany` over the latest and previous ids (scored items only, with section and pillar codes).
  - `getBuildingHistory(token: string | null, buildingId: string): Promise<BuildingHistory | null>` where `BuildingHistory = { building: Named & { unit: Named; cluster: Named; campus: Named }; assessments: (ScoredAssessment & { number: number; version_label: string })[] }`, oldest first, `number` from 1.
  - `compareAssessments(token: string | null, aId: string, bId: string): Promise<Comparison | null>` — `null` unless both are in scope and in the same building.
- Produces (hooks): `useSafetyRollup(scope)` key `['building-safety', scope]`; `useBuildingHistory(buildingId)` key `['building-history', buildingId]`; `useCompareAssessments(aId, bId)` key `['assessment-compare', aId, bId]`, enabled only with both.

- [x] **Step 1: Implement the actions** (active buildings only; `notAssessed` = in-scope buildings without `latest`).
- [x] **Step 2: Implement the hooks.**
- [x] **Step 3: Run** `npm run type-check`, `npm run lint` → pass.
- [x] **Step 4: Commit** `feat(assessment): building safety rollup, history and compare actions`

### Task 10: Charts

**Files:**

- Create: `src/app/(admin)/_components/charts/grouped-bars.tsx`, `row-chart.tsx`, `line-chart.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**

- Produces:
  - CSS tokens `--series-1` … `--series-6`, with dark values under `.dark`, picked and validated with the `dataviz` skill (categorical, distinguishable in both themes, maroon kept for the brand bar).
  - `GroupedBars({ groups, series, label, onSelect }: { groups: string[]; series: { id: string; name: string; color: string; values: (number | null)[]; previous: (number | null)[] }[]; label: string; onSelect?: (seriesId: string) => void })` — one group per metric (Overall, Prevention, Preparedness, Response), one bar per series with its % printed and a thin tick at the previous value; legend entries and bars call `onSelect`.
  - `RowChart({ rows, label, onSelect }: { rows: { id: string; name: string; value: number | null; previous: number | null }[]; label: string; onSelect?: (id: string) => void })` — one row per child, lowest first, `null` last as "—".
  - `LineChart({ points, lines, label }: { points: { label: string; sublabel?: string; marker?: string }[]; lines: { id: string; name: string; color: string; values: (number | null)[] }[]; label: string })` — 0–100 y axis; `marker` (linked event name) drawn on the point.
  - Every chart prints its values and labels every colour (like `summary/charts.tsx`): readable without hover and in black and white.

- [x] **Step 1: Load the `dataviz` skill**, add the tokens, build the three charts.
- [x] **Step 2: Check** them on a scratch page under `npm run dev` with fixed data at 320 / 1280 px, light and dark; remove the scratch page.
- [x] **Step 3: Commit** `feat(assessment): building safety charts`

### Task 11: Dashboard "Building safety" section

**Files:**

- Create: `src/app/(admin)/dashboard/_components/building-safety/building-safety.tsx`, `breadcrumb.tsx`, `summary-tiles.tsx`, `children-chart.tsx`, `children-table.tsx`, `section-scores.tsx`, `most-failed.tsx`, `building-level.tsx`, `compare-panel.tsx`
- Modify: `src/app/(admin)/dashboard/page.tsx`, `src/app/(admin)/assessments/_components/buildings-tab.tsx`

**Interfaces:**

- Consumes: Tasks 8–10; `useScopedCampusId`, `useIsSuperAdmin`; `ChangeBadge` (Task 4).
- Produces: `<BuildingSafety />`, placed in `dashboard/page.tsx` below the reports/events cards and above `MonthCard`.

- [x] **Step 1: State.** `scopeFromParams(useSearchParams(), …)`; drilling sets the `bs_` params with `router.replace(…, { scroll: false })` and clears the deeper ones; the section's own Suspense boundary. Drilling never touches `useCampusScopeStore`.
- [x] **Step 2: Aggregate levels** (`all`, `campus`, `cluster`, `unit`):
  - Breadcrumb (e.g. "UP Manila › Pedro Gil › College of Nursing"); an Administrator's starts at their campus, with no "All campuses".
  - Tiles: Overall, Prevention, Preparedness, Response = `percent(group.current…)` with `ChangeBadge` of the like-for-like pair and the "▲ n pts · k of m buildings re-assessed" line; Recovery = "{n} of {m} buildings have a Public Service Continuity Plan" with the change in n.
  - Chart: `GroupedBars` up to 6 children, else `RowChart` with an Overall / Prevention / Preparedness / Response toggle; clicking drills in.
  - Children table: name, assessed / total, overall, the three pillars with change, PSCP n/m, last assessed; rows drill in. "Not yet assessed ({n})" under it, listing the names at unit level.
  - "By section" in a collapsed `<details>`; "Most-failed items" with the fixed copy.
  - Empty campus (nothing assessed yet): one `EmptyNote`.
- [x] **Step 3: Building level:** `LineChart` of overall across #1…#n (labels "#k" + date, the event name as marker), a toggle to add the three pillar lines; A / B pickers listing "#k · date · overall % · event" defaulting through `comparePair`; the comparison table (Overall, four pillars — Recovery as In place / Missing / N/A — and the sections, each A, B, change; "—" when absent), the version note when `versionsDiffer`, and links to each side's detail page. One assessment: show it and "Needs a second assessment to compare".
- [x] **Step 4: "Compare"** on a Buildings-tab row links to `/dashboard?bs_campus=…&bs_cluster=…&bs_unit=…&bs_building=…`.
- [x] **Step 5: Check** under `npm run dev` with the Task 12 sample data (write the data first if needed), 320 / 390 / 900 / 1280, light and dark.
- [x] **Step 6: Commit** `feat(assessment): building safety section on the dashboard`

### Task 12: Sample data, Part B check, docs, push

- [x] **Step 1: Sample data (ask the user first).** A scratchpad script (`npx tsx --tsconfig tsconfig.json --env-file=.env.development.local <scratchpad>/sample-assessments.ts`) that, in one campus, creates buildings named "Sample …" in two clusters / two units — buildings with 1, 2 and 4 assessments, one with Laboratories ticked only in its later assessments, and one unit with 7 buildings — with seeded answers written through `prepareAssessmentWrite` (answers, pillar rows, `needs_follow_up`) and `ended_at` spaced a month apart. It prints what it created; a second run does nothing. Name everything "Sample" so it can be found and removed.
- [x] **Step 2: Hands-on (spec Section 7)** on a production build:
  - Pillar math: for one assessment, the four pillar rows equal its overall; at each level the tiles equal a hand sum over each building's latest rows (print the sums from a scratch script); older assessments don't count.
  - Drill campus → cluster → unit → building and back by the breadcrumb and the browser Back button; a reload keeps the level.
  - Like-for-like: the building with one assessment raises the current % but not the change; "k of m re-assessed" is right.
  - Building with 4: default #3 vs #4; #1 vs #4 changes the table; A = B can't be picked; Labs shows "—" with no change where it applied only in B.
  - The 7-building unit shows the row chart.
  - Administrator: no "All campuses"; a URL with another campus's `bs_campus` still shows their own. Super admin: All campuses → campus works.
- [x] **Step 3: Docs:** spec Section 6 tick Task 10 and Docs; Section 2 tick the dashboard criterion and, if all checked, "Light and dark mode; phone, tablet and web layouts"; Section 7 tick Pillar math, Dashboard drill-down and Language. CLAUDE.md: the Building safety section (`building-safety.ts`, `bs_` URL params, `requireAdmin`). README: dashboard Building safety. This plan: status Done.
- [x] **Step 4: Run** `npm run lint && npm run type-check && npm run test && npm run build`.
- [x] **Step 5: Commit and push** `docs(assessment): document building safety (phase 2)`.
