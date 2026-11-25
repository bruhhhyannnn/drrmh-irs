---
type: fix
ticket: DRRM-051
status: in-review
branch: fix/DRRM-051-post-hardening-follow-ups
modules:
  - '[[bystander-reports]]'
  - '[[settings-lookups]]'
  - '[[database]]'
tags: [plan, fix, security]
---

# [DRRM-051] Fix Plan: Follow-ups after the security batch

- **Status:** `[In Review]`
- **Related Bugs / Audits:** DRRM-049 non-goal (zod 3 → 4), GHSA-mrhx-c7xc-m3w5, DRRM-048 §4 follow-up
- **Target Branch / PR:** `fix/DRRM-051-post-hardening-follow-ups` (PR #132)
- **Author:** Bryan Mangapit

---

## 1. Objective & Scope

What was still open after DRRM-045 to DRRM-050:

1. **zod 3.25 → 4.6.7, @hookform/resolvers 3 → 5.** Zod 3 checks every entry of a list past its
   `.max()` before refusing it. Measured: a ~6 MB body of `{}` × 2,000,000 (under the 8 MB server
   action limit) made 4,000,001 issues and +883 MB of heap in 3.4 s. `createBystanderReport`
   needs no sign-in, and the rate limit still lets 30 of these through per network per 10
   minutes. Zod 4.6.7 returns 1 issue.
2. **Indexes (DRRM-048 §4).** Four single-column indexes are covered by a wider index that
   starts with the same column and only cost writes.
3. **CI** didn't run the unit tests, and used Node 20, which is end-of-life.
4. **Docs:** the plans index still listed DRRM-029 to DRRM-050 as in review or in progress.

Not in this PR: turning the CSP from report-only to enforcing (needs the browser consoles
checked on the deployed admin pages), Vercel Skew Protection (a dashboard setting), the zod
deprecations that still work (`z.string().email()`, `.superRefine`, `.strict()`).

---

## 2. Technical Solution & Changes Required

### 2.1 Backend / Server Actions

- [x] `package.json`: `zod ^4.6.7`, `@hookform/resolvers ^5.9.2` (the lockfile also dedupes
      shadcn's own zod 4 copies).
- [x] `src/lib/schemas.ts`:
  - `.uuid()` → `.guid()` everywhere: zod 4's `uuid()` also checks the version and variant
    digits; `guid()` is zod 3's loose pattern, so no stored id starts failing.
  - `partialEdit(schema)`: every field optional and `.default()` unwrapped, keeping the object's
    strictness. Zod 4 applies a default even inside `.optional()`, so `.partial()` turned an edit
    that leaves `is_active` out (a rename) into `is_active: true`. Used by `settingsEditSchemas`,
    `populationCategoryUpdateSchema`, `campusPopulationLinkUpdateSchema` and
    `userUpdateInputSchema`.
  - `required_error` / `invalid_type_error` / `errorMap` → `error` (the location message only
    when the coordinate is missing, as before); `z.ZodIssueCode.custom` → `'custom'`;
    `.finite()` dropped (zod 4 numbers are finite).
  - `*FormInput` types (`z.input`) for the forms.
- [x] `src/actions/settings/index.ts`: `EDIT_SCHEMAS` on edit; `z.AnyZodObject` → `z.ZodObject`.
- [x] `src/actions/campus-table/index.ts`: `updateCampus` parses `partialEdit(campusWrite)`.

### 2.2 Frontend / Components

- [x] Campus drawer, headcount field drawer, user drawer and the checklist editor's section,
      wording and area type forms: `useForm<Input, unknown, Output>`. Active switches read
      `field.value ?? true` (the schema default); the section's area select reads a string only.

### 2.3 Database / Prisma

- [x] `prisma/manual/DRRM-051-drop-covered-indexes.sql`: drops `reports (event_id)`,
      `reports (cluster_id)`, `bystander_reports (status_id)` and
      `report_population_counts (report_id)`. Each is found by definition (plain btree, one key,
      not unique), and dropped only while another valid btree index on the table starts with
      the same column; otherwise a NOTICE says it was kept. Idempotent; rollback in the file.
- [x] `prisma/schema.prisma`: the four `@@index` lines removed.

### 2.4 CI and docs

- [x] `.github/workflows/ci.yml`: `npm run test` step, Node 22.
- [x] `CLAUDE.md`, `README.md`, [[architecture]], [[conventions]], [[database]],
      [[settings-lookups]], [[bystander-reports]], [[changelog]].
- [x] [[00-index]]: DRRM-029 to DRRM-050 moved to Done with their PRs; their plans set to `done`.

---

## 3. Verification

- [x] `npm run lint`, `npm run type-check`, `npm run test` (362 pass; 9 new: oversized lists,
      loose ids, the location, consent and floor messages, edits that leave Active out, edit
      schemas stay strict, Add still turns a row on).
- [x] CI on PR #132: audit, lint, type-check, the tests on Node 22, build. Vercel preview built.
- [x] The index SQL on a throwaway local Postgres 18 with the same tables and indexes: drops the
      four when the wide indexes exist, keeps `bystander_reports (status_id)` with a NOTICE while
      its composite is missing, and a second run does nothing.
- [ ] Manual, on the preview: each form still shows its messages (sign-in, forgot and update
      password, Add / Edit user, profile setup, off-campus setup, bystander form, ERT report,
      Settings Add / Edit, campus drawer, headcount fields, checklist editor); rename a
      turned-off Settings row, campus and headcount field and check each stays off.
- [ ] Apply `DRRM-051-drop-covered-indexes.sql` on staging, then production, after DRRM-048's file.
