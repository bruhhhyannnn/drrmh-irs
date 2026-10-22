---
type: reference
updated: 2026-10-22
verified: true
tags: [conventions]
---

# Conventions

This note holds the detail behind the short Conventions list in `CLAUDE.md`. Read it before styling a component, building a form, or writing a doc in this vault.

**Related:** [[00-index]] · [[architecture]] · [[database]] · [[design-system]]

## Code

- **Path alias:** `@/*` → `src/*` (`tsconfig.json`).
- **Prettier** (`prettier.config.js`): single quotes, semicolons, print width 100, tab width 2, `trailingComma: 'es5'`.
  - Tailwind class sorting and import organizing run automatically through `prettier-plugin-tailwindcss` and `prettier-plugin-organize-imports`. Don't hand-order imports or Tailwind classes.
  - ESLint runs Prettier as a rule (`eslint-plugin-prettier`, `'prettier/prettier': 'warn'` in `eslint.config.mjs`), so `eslint --fix` also formats.
- **Pre-commit:** the Husky hook runs `lint-staged`:
  - `eslint --fix` on staged `*.{ts,tsx}`
  - `prettier --write` on staged `*.{js,jsx,json,css,md}`, which includes these notes.
- **Vendored map:** `src/components/ui/map.tsx` is vendored from mapcn and listed in the `ignores` of `eslint.config.mjs`. Don't "fix" lint issues there.
- **Generated Prisma client:** never hand-edit it ([[database]]).
- **Forms:** Zod schemas live in `src/lib/schemas.ts`, and forms use `react-hook-form` + `@hookform/resolvers` (`zodResolver`).
- **Hooks:** one hook file per domain in `src/components/hooks/`. Mutations invalidate query keys on success (see `use-events.ts`).
- **Lookup tables:** a new one extends `LOOKUPS` / `LookupTable`, not a new CRUD page ([[0009-table-driven-settings]]).
- **Campus filters:** admin queries take the scoped campus id from `useScopedCampusId`. Don't add per-page campus filters ([[campus-scoping]]).
- **Caller checks:** new server actions that need to know the caller verify the Supabase token (`requireProfile` / `requireAdmin`) instead of trusting an id from the client. Expected failures return `{ ok: false, error, retry }` and are not thrown ([[0007-token-verified-actions]]).

## Theme (light / dark)

- **Tokens:** colours are theme tokens in `src/app/globals.css` that change under `.dark` on `<html>`. A script in the root layout sets the class before the first paint. So classes like `text-gray-600` or `text-brand-500` need no `dark:` variant.
- **Which token where:**
  - `bg-canvas` for page backgrounds.
  - `bg-surface` (not `bg-white`) for cards, bars, drawers and inputs.
  - `border-line` for hairlines.
  - `bg-brand-solid` for maroon fills with white text on them (primary buttons, avatars).
- **Hex values** in class names stay the same in both themes (the maroon heroes).
- **The user's choice:** Light / Dark / Device is saved per device by `useThemeStore` and set in My profile.
- **Light subtree:** `data-theme="light"` keeps a subtree light, e.g. the A4 report.
- **Charts** use the `--series-1…6` tokens ([[0008-hand-built-charts]]).

More on the components in [[design-system]].

## Database

The schema rules, the manual-SQL process, the exact `db execute` command and the DISALLOWED commands are in [[database]].

## Verify before calling it done

```bash
npm run lint && npm run type-check && npm run test && npm run build
```

Test accounts for the browser are in `test-accounts.local.md` at the repo root. It is gitignored, so never copy it into the docs.

## Docs (this vault)

- **Where:** document every non-trivial task, review, bug analysis and feature spec under `docs/`:
  - plans in `plan/{feature,fix,bugs,review}/` (the purpose of each folder is in `docs/README.md`)
  - one note per area of code in `modules/`
  - one note per decision in `decisions/`

  Start new docs from the `TEMPLATE.md` in each folder.

- **Names:** kebab-case with a ticket or date prefix, e.g. `plan/fix/DRRM-003-report-form-atomicity.md`, `plan/review/2026-09-08-dev-branch-audit.md`, `decisions/0004-offline-queue-bundled-create.md`.
- **Status header:** `- **Status:** [Draft | In Review | Approved | In Progress | Done]`. The templates don't fully agree: the feature template says `Completed` instead of `Done`, and the bug template uses `Open | In Progress | Resolved`.
- **Branches map 1:1 to plans:** `feat/DRRM-015-...` ↔ `plan/feature/DRRM-015-...`, `fix/...` ↔ `plan/fix/...`. The older `CLAUDE.md` example `bugfix/DRRM-003-...` matched no real branch.
- **Plan frontmatter** (all plans and templates have it):

  ```yaml
  ---
  type: feature # feature | fix | bug | review
  ticket: DRRM-015
  status: in-progress # draft | in-review | approved | in-progress | done
  branch: feat/DRRM-015-assessment-form
  modules:
    - '[[assessments]]'
    - '[[offline-pwa]]'
  tags: [plan, feature]
  ---
  ```

  Keep the `- **Status:** ...` line in the body too. When the status changes, update both.

- **Note frontmatter:** module and reference notes carry `type`, `updated` (date of the last check) and `verified: true` once their claims were checked against the code.
- **Links:**
  - Plans link to modules through `modules:`. Module notes don't list their plans, because Obsidian's Backlinks pane shows them.
  - In note bodies, use `[[wikilinks]]`, and name code with backtick paths.
  - Links to source files in plans use relative Markdown links (`[x](../../../src/lib/x.ts)`) so they also work on GitHub. Never use `file:///` links.
  - The four `TEMPLATE.md` files share a name, so link them by path: `[[plan/fix/TEMPLATE]]`.
- **After a task,** update the module note for the area you changed, and set its `updated` date.
- **When a decision is made,** add `decisions/NNNN-slug.md` from [[decisions/TEMPLATE]] and link it from the module notes it affects.
- **When a ticket merges,** add a line to [[changelog]] and set the plan's status to `done`.
