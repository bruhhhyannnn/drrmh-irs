---
type: fix
ticket: DRRM-051
status: in-review
branch: fix/DRRM-051-post-hardening-follow-ups
modules:
  - '[[bystander-reports]]'
  - '[[settings-lookups]]'
tags: [plan, fix, security]
---

# [DRRM-051] Fix Plan: Follow-ups after the security batch

- **Status:** `[In Review]`
- **Related Bugs / Audits:** DRRM-049 non-goal (zod 3 → 4), GHSA-mrhx-c7xc-m3w5
- **Target Branch / PR:** `fix/DRRM-051-post-hardening-follow-ups`
- **Author:** Bryan Mangapit

## 1. Objective & Scope

- **zod 3.25 → 4.6.7, @hookform/resolvers 3 → 5.** Zod 3 checks every entry of a list past its
  `.max()` before refusing it. Measured: a ~6 MB body of `{}` × 2,000,000 (under the 8 MB limit)
  made 4,000,001 issues and +883 MB of heap in 3.4 s. `createBystanderReport` needs no sign-in.
  Zod 4.6.7 returns 1 issue.
- **CI** runs `npm run test` and uses Node 22 (Node 20 is end-of-life).

Not in this PR: dropping the redundant single-column indexes (DRRM-048 §4), the 00-index status
refresh, turning the CSP to enforcing, Vercel Skew Protection.

## 2. Changes

- `.uuid()` → `.guid()`: zod 4's `uuid()` also checks the version and variant digits. `guid()` is
  zod 3's looser pattern, so no stored id starts failing.
- `partialEdit()` in `src/lib/schemas.ts`: zod 4 applies `.default()` inside `.optional()`, so
  `.partial()` turned a rename into `is_active: true`. Settings edits (`settingsEditSchemas`),
  Edit campus, headcount field edits, campus field links and Edit user use it.
- `required_error` / `invalid_type_error` / `errorMap` → `error`; `ZodIssueCode.custom` → `'custom'`.
- Forms: `useForm<Input, unknown, Output>` with new `*FormInput` types; Active switches read
  `field.value ?? true`.

## 3. Verification

- [x] `npm run lint`, `npm run type-check`, `npm run test` (362 pass; 9 new)
- [ ] `npm run build` (not run locally; CI runs it)
- [ ] Manual: every form shows its messages (sign-in, Add/Edit user, profile setup, off-campus setup,
      bystander form, ERT report, Settings Add/Edit, campus drawer, checklist editor); rename a
      turned-off Settings row or campus and check it stays off.
