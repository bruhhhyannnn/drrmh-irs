---
type: feature
ticket: DRRM-021
status: draft
branch: 'feat/DRRM-021-assessment-pre-test-polish'
modules: [assessments, building-safety]
tags: [plan, feature, assessment]
---

# DRRM-021 Assessment Pre-Test Polish Implementation Plan

- **Status:** `Draft`
- **Target Branch / PR:** `feat/DRRM-021-assessment-pre-test-polish`
- **Owner / Author:** Jomar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the assessment tasks from the Oct 23 meeting due before the UPRI IB test (tasks #1, #2, #3, #6 in `.docs/matatag-dev-tasks.md`).

**Architecture:** Pure logic (progress totals, building-name matching) goes in `src/lib` with `node:test` coverage; UI changes stay in the existing ERT assessment components (`src/app/(ert)/assessment/_components/`) and the dashboard building-safety parts. No schema change, no new server action.

**Tech Stack:** Next.js 16 (App Router), React, Tailwind theme tokens, framer-motion 13 (already a dependency), Prisma, `node:test` via tsx.

**Spec:** `.docs/matatag-dev-tasks.md` (tasks #1, #2, #3, #6). Read `docs/modules/assessments.md` and `docs/modules/building-safety.md` first.

## Out of scope

- #4 CP/EP/PSCP — the checklist already splits Q3 into 3.1 Crisis Plan / 3.2 Emergency Preparedness Plan / 3.3 Public Service Continuity Plan / 3.4 Contingency Plan (`prisma/data/matatag-2025-07-25.ts`). Only the IB's final wording is pending; change the data and run `npm run seed:matatag` when it arrives.
- #5 offline — already built (IndexedDB drafts + queue, service key server-only). RLS check is a separate review, not code here.

## Global Constraints

- Dashboard heading copy: **"For improvement"** (sentence case, matching other dashboard headings). Replaces "Most-failed items".
- Building dropdown option copy: **"Others (please specify)"**. Replaces "Add a building…".
- Building names match when equal after trim, collapsing runs of whitespace to one space, and lowercasing (e.g. `"  UP   Diliman "` ≡ `"up diliman"`).
- Theme tokens only, no `dark:` variants (`docs/conventions.md`).
- Animations honour `prefers-reduced-motion` (framer-motion `useReducedMotion`): reduced → no movement, instant swap.
- Don't change the `mostFailed` arithmetic or the `building_safety` action's payload shape — only names/copy.

## Review Focus

1. A section with zero applicable scored items (all areas unticked) — must not show as "done" and must not count in the overall total. → test in Task 1.
2. Typed name with double inner spaces (`"Main  Hall"`) vs listed `"Main Hall"` — must pick the existing building on client **and** server. → tests in Task 3.
3. Answering the last question of a section auto-advances — the transition must play once, not on every answer within the same section. → keyed on `current` step, verified manually in Task 2.
4. Reduced motion — no slide. → manual check in Task 2.
5. Finished sections collapsed in the index — the current section must never be collapsed even if done (user reopened it to edit). → Task 1 Step 5.

---

### Task 1: Section done indicator, overall progress, collapsed finished sections (#1)

**Files:**

- Modify: `src/lib/assessment-draft.ts` (next to `sectionProgress`, ~line 227)
- Modify: `src/lib/assessment-draft.test.ts`
- Modify: `src/app/(ert)/assessment/_components/section-index.tsx` (~lines 160–250)
- Modify: `src/app/(ert)/assessment/_components/section-step.tsx` (section header)

**Interfaces:**

- Produces:
  - `export type SectionProgress = { answered: number; total: number }` (use it as `sectionProgress`'s value type)
  - `export function isSectionDone(p: SectionProgress | undefined): boolean` — `true` iff `p && p.total > 0 && p.answered === p.total`
  - `export function overallProgress(progress: Record<string, SectionProgress>): SectionProgress & { sectionsDone: number; sections: number }` — sums only sections with `total > 0`

- [ ] **Step 1: Write failing tests** in `assessment-draft.test.ts`:

```ts
test('isSectionDone: needs at least one item and all answered', () => {
  assert.equal(isSectionDone(undefined), false);
  assert.equal(isSectionDone({ answered: 0, total: 0 }), false);
  assert.equal(isSectionDone({ answered: 2, total: 3 }), false);
  assert.equal(isSectionDone({ answered: 3, total: 3 }), true);
});

test('overallProgress: sums sections, skips empty ones', () => {
  const r = overallProgress({
    a: { answered: 3, total: 3 },
    b: { answered: 1, total: 4 },
    c: { answered: 0, total: 0 },
  });
  assert.deepEqual(r, { answered: 4, total: 7, sectionsDone: 1, sections: 2 });
});
```

- [ ] **Step 2: Run** `npm run test` — Expected: FAIL, `isSectionDone` / `overallProgress` not exported.
- [ ] **Step 3: Implement** both in `assessment-draft.ts`; replace the inline `done` check at `section-index.tsx:177` with `isSectionDone(p)`.
- [ ] **Step 4: Run** `npm run test` — Expected: PASS.
- [ ] **Step 5: Index UI** in `section-index.tsx`:
  - Above the `<ol>`: a progress bar (`bg-gray-100` track, `bg-success-500` fill, width = answered/total %) with text `{sectionsDone} of {sections} sections done · {answered}/{total} questions` (Mono numbers). Give the bar `role="progressbar"` with `aria-valuenow/min/max`.
  - A done section that is **not** current renders compact: one line, code + English title `truncate`, no Filipino line, success check. Current or unfinished sections render as today.
  - Add a toggle button under the bar, `Hide finished ({n})` / `Show finished ({n})`, default **shown**; persist in component state only. Hidden done sections are omitted from the list except the current one.
- [ ] **Step 6: Section header** in `section-step.tsx`: when `isSectionDone(progress[section.id])`, show `<Pill tone="success">Done</Pill>` beside the section title.
- [ ] **Step 7: Verify** `npm run lint && npm run type-check`, then in the browser (`npm run dev`, ERT test account from `test-accounts.local.md`) on mobile width and desktop: answer a section fully → check + compact row + bar advances; toggle hides it; reopening it keeps it expanded.
- [ ] **Step 8: Commit** `feat(assessment): show finished sections and overall progress`

---

### Task 2: Animate the move to the next section (#2)

**Files:**

- Modify: `src/app/(ert)/assessment/_components/assessment-stepper.tsx` (where `content` is rendered, after ~line 320)

**Interfaces:**

- Consumes: `isSectionDone` (Task 1), `current: DraftStep`.

- [ ] **Step 1: Wrap `content`** in `<AnimatePresence mode="wait" initial={false}>` + `<motion.div key={current}>` from `framer-motion`. Variants: enter `{ opacity: 0, x: 24 }` → `{ opacity: 1, x: 0 }`, exit `{ opacity: 0, x: -24 }`, `duration: 0.18`, `ease: 'easeOut'`. Direction flips (enter from −24) when the new step's index in `steps` is lower than the previous one (track previous index in a `useRef`).
- [ ] **Step 2: Reduced motion:** `const reduce = useReducedMotion()`; when true, use `x: 0` everywhere and `duration: 0`.
- [ ] **Step 3: Announce** the move for screen readers: an `aria-live="polite"` visually hidden span that, when `current` changes **to** a section from a section that `isSectionDone`, reads `Section {prevCode} done. Now on section {code}.`
- [ ] **Step 4: Verify** `npm run lint && npm run type-check`; in the browser: answering the last item of section I slides to II once; answering within a section doesn't re-animate; Back slides the other way; with OS reduced motion on, no slide. Check the `focusItem` jump from Review still scrolls to the right question (the effect runs after the enter animation mounts — if it misses, run the scroll in `onAnimationComplete`).
- [ ] **Step 5: Commit** `feat(assessment): slide between sections`

---

### Task 3: Building picker "Others (please specify)" with whitespace-safe matching (#6)

**Files:**

- Create: `src/lib/building-name.ts`
- Create: `src/lib/building-name.test.ts`
- Modify: `src/app/(ert)/assessment/_components/details-step.tsx:102-109, 177`
- Modify: `src/actions/assessments/index.ts:154-160` (`findSameName`) and wherever `name` is derived before it (store the normalized form)

**Interfaces:**

- Produces:
  - `export function normalizeBuildingName(name: string): string` — trim + collapse `\s+` to `' '` (case kept, for storing/display)
  - `export function buildingNameKey(name: string): string` — `normalizeBuildingName(name).toLowerCase()`
  - `export function findBuildingByName<T extends { name: string }>(list: T[], name: string): T | undefined` — `undefined` when the key is empty

- [ ] **Step 1: Write failing tests** in `building-name.test.ts`:

```ts
test('normalizeBuildingName trims and collapses spaces', () => {
  assert.equal(normalizeBuildingName('  UP   Diliman '), 'UP Diliman');
});
test('findBuildingByName ignores case and spacing', () => {
  const list = [
    { id: '1', name: 'Main Hall' },
    { id: '2', name: 'UP Diliman' },
  ];
  assert.equal(findBuildingByName(list, ' up  diliman')?.id, '2');
  assert.equal(findBuildingByName(list, 'main\thall')?.id, '1');
  assert.equal(findBuildingByName(list, 'Annex'), undefined);
  assert.equal(findBuildingByName(list, '   '), undefined);
});
```

- [ ] **Step 2: Run** `npm run test` — Expected: FAIL, module not found.
- [ ] **Step 3: Implement** `src/lib/building-name.ts`.
- [ ] **Step 4: Run** `npm run test` — Expected: PASS.
- [ ] **Step 5: Client:** in `details-step.tsx`, change the option label to `'Others (please specify)'`; `checkTypedName` uses `findBuildingByName(buildings, form.getValues('new_building_name'))`; the value written to `new_building_name` on change is kept raw (typing) but the payload uses `normalizeBuildingName` (apply in `toPayload` in `assessment-draft.ts` if that's where `new_building_name` is emitted). Rename the "Building name" field label to `Specify the building`.
- [ ] **Step 6: Server:** in `src/actions/assessments/index.ts`, normalize `name` with `normalizeBuildingName` before lookup/create, and replace the `toLowerCase()` comparison in `findSameName` with `findBuildingByName(siblings, name)`. Note: the DB unique index is on `lower(name)` only, so existing rows saved with double spaces still won't collide in SQL — the app-level match covers them.
- [ ] **Step 7: Verify** `npm run test && npm run lint && npm run type-check`; in the browser pick "Others (please specify)", type `main   hall` for a unit that has "Main Hall" → "Already listed — selected it".
- [ ] **Step 8: Commit** `feat(assessment): Others (please specify) building option, match names ignoring spacing`

---

### Task 4: Rename "Most-failed items" to "For improvement" (#3)

**Files:**

- Modify: `src/app/(admin)/dashboard/_components/building-safety/parts.tsx:269-273` (component `MostFailed` → `ForImprovement`, heading copy)
- Modify: `src/app/(admin)/dashboard/_components/building-safety/building-safety.tsx:19, 279`
- Modify: `src/actions/building-safety/index.ts:37` (doc comment only)
- Check: `src/app/(ert)/assessment/_components/assessment-print.tsx`, `src/app/(admin)/_lib/` (NSED report) for the same wording

**Interfaces:** none new. Keep `mostFailed()` and the `mostFailed` data field as-is (internal names; avoids churn in tests and the action payload).

- [ ] **Step 1:** `grep -rni "most.failed\|failed items" src` — list every user-visible hit.
- [ ] **Step 2:** Change heading to `For improvement`; rename the component to `ForImprovement`; update any helper/empty-state copy that says "failed" to "for improvement" (e.g. "No items for improvement").
- [ ] **Step 3:** Apply the same copy to each user-visible hit from Step 1 (print/report).
- [ ] **Step 4: Verify** `npm run lint && npm run type-check && npm run build`; open the dashboard as Administrator → section reads "For improvement".
- [ ] **Step 5: Commit** `feat(dashboard): rename Most-failed items to For improvement`

---

### Task 5: Docs

- [ ] Update `docs/modules/assessments.md` (progress/collapse, transition, building option + name matching) and `docs/modules/building-safety.md` (heading rename), bump their `updated` dates.
- [ ] Set this plan's status to `Done`; tick #1, #2, #3, #6 in `.docs/matatag-dev-tasks.md`.
- [ ] Commit `docs(DRRM-021): module notes for the assessment pre-test polish`
