# [DRRM-015] Feature Plan: Unit and end-to-end tests

- **Status:** `[In Review]`
- **Target Branch / PR:** `feat/DRRM-015-test-suite`
- **Owner / Author:** Bryan Mangapit
- **Source:** request to add end-to-end tests ("maybe Vitest"). Stacked on `feat/DRRM-014-drrm-pillars`, since the tests cover the redesigned pages that aren't on `dev` yet.

---

## 1. Problem Statement & Motivation

The project had no automated tests: CI ran lint, type-check and build, and screens were checked by hand through temporary preview routes. The logic most likely to break quietly has no screen of its own: contact number normalisation, the offline queue, the event summary behind campus details, event details and the PDF, and stripping Exif/GPS from bystander photos.

Vitest alone isn't an end-to-end tool. It runs code in Node or jsdom, with no real browser, server or database. So the suite has two parts:

- **Vitest** for unit and component tests: fast, needs no secrets, runs in CI.
- **Playwright** for end-to-end tests: Chromium against the running app and the dev database, run locally.

Decisions (asked and answered before building):

- Tooling: Vitest + Playwright.
- Database: the end-to-end tests read the shared dev database and **never write to it**. Writes are stopped in the browser (below), not cleaned up afterwards.
- Signed-in tests: a test admin account from `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`; without it they are skipped.
- CI: unit tests only. End-to-end runs locally (`npm run test:e2e`).

---

## 2. Requirements & User Stories

- **As a developer**, I want `npm run test` to tell me in seconds if I broke shared logic, without a database or secrets.
- **As a developer**, I want `npm run test:e2e` to click through the real pages (public form, sign-in, admin shell) without leaving test rows in the shared database.

Acceptance criteria:

- [x] `npm run test` runs Vitest once (CI); `npm run test:watch` re-runs on save.
- [x] `npm run test:e2e` runs Playwright, reusing `npm run dev` on port 3000 or starting it.
- [x] No end-to-end test can write to the database or send auth emails, whatever the test does.
- [x] Admin tests skip with a clear reason when no test login is set.
- [x] CI runs the unit tests.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- None.

### Unit tests (Vitest)

- `vitest.config.mts`: `src/**/*.test.{ts,tsx}`, `@` alias, Node environment by default (jsdom per file with `// @vitest-environment jsdom`, which made the run about 6x faster than jsdom everywhere on Windows), `TZ=Asia/Manila`, dummy Supabase env pointing at `127.0.0.1:54321`, mocks reset between tests.
- `vitest.setup.ts`: mocks `next/font/google` (the `@/components/ds` barrel loads the fonts), and in jsdom adds jest-dom matchers, RTL cleanup, `localStorage.clear()` and a `matchMedia` stub.
- No `@vitejs/plugin-react`: Vite compiles TSX from tsconfig's `"jsx": "react-jsx"`, and the plugin's optional Babel peers clash with next-pwa's in npm.
- Versions: Vitest 4.1 and jsdom 28, because CI runs Node 20 (Vitest 5 needs Node 22.12+, jsdom 30 needs 22.22+).

Tests (122):

| File                                                                                         | Covers                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/schemas.test.ts`                                                                    | `toPhContactNumber`, bystander payload normalisation, event times, password rules, population codes                           |
| `src/lib/utils.test.ts`                                                                      | `isAdminUserType`, population count helpers, photo `FormData`                                                                 |
| `src/lib/offline-queue.test.ts`                                                              | queue add/list/fail/remove on `fake-indexeddb`, stores kept apart, `isNetworkError`                                           |
| `src/lib/bystander-photos.test.ts`                                                           | Exif/XMP/comments stripped but JFIF and ICC kept, bad files skipped, 3-photo cap, upload errors, signed URLs (Storage mocked) |
| `src/lib/prisma-error.test.ts`                                                               | P2002 / P2003 / P2025 messages                                                                                                |
| `src/lib/theme.test.ts`                                                                      | saved preference, `applyTheme`, the inline `THEME_SCRIPT` agrees with it                                                      |
| `src/app/(admin)/_lib/summary.test.ts`                                                       | `buildSummary` totals, cluster order, severity sort, damage, timeline bins, compare-with-last-drill                           |
| `src/app/(admin)/_lib/format.test.ts`, `status.test.ts`                                      | event windows, dates, status colours, user type labels                                                                        |
| `src/app/(ert)/report/_lib/draft.test.ts`                                                    | ERT report drafts in localStorage                                                                                             |
| `src/app/(public)/bystander-report/_lib/summary.test.ts`, `src/components/ds/people.test.ts` | review step and people summaries                                                                                              |
| `src/components/ds/people-drawer.test.tsx`                                                   | component test: add, validate, Done keeps the draft, Cancel discards                                                          |

### End-to-end tests (Playwright)

- `playwright.config.ts`: projects `setup` → `admin` (saved session), and `public`. Chromium, `Asia/Manila`, service workers blocked (their requests would skip the guard), traces and screenshots on failure, 3 workers (the dev server compiles pages on first visit). Loads `.env.local` / `.env` for the test login.
- **Write guard** (`e2e/support/writes.ts`, installed for every test by the auto fixture in `e2e/support/test.ts`): a server action call is a POST with a `next-action` header. The guard looks the id up in Next's `server-reference-manifest.json` (dev, dev per-page, and build) and lets it through only if the exported name starts with `get`. Unknown ids are blocked too. Supabase calls other than reads and `POST /auth/v1/token` (sign-in, refresh) are blocked, which covers reset emails, password changes and sign-out (that would end the shared session). Blocked calls are aborted, so the app sees a dropped connection; `writes.blocked` lists them and each is noted on the report.
- This relies on a naming rule that holds today (checked for every action): read-only actions are named `get…`, and nothing named `get…` writes. Recorded in CLAUDE.md.

Specs:

- `public/landing.spec.ts`: landing to the report form and to sign-in; 404.
- `public/access.spec.ts`: signed out, admin pages go to `/signin?from=…`, `/report` to `/signin`.
- `public/sign-in.spec.ts`: email check, password step and Change, a failed sign-in (token call mocked), the `?error=domain` banner, forgot password with the email carried over (recover call mocked).
- `public/bystander-report.spec.ts`: step 1 errors; with a granted device location, a report sent offline is saved in IndexedDB; a report whose send is cut off (the guard stops `createBystanderReport`) is kept in the queue; contact number checked on review.
- `auth.setup.ts`: signs in through the form and saves `e2e/.auth/admin.json` (gitignored).
- `admin/navigation.spec.ts`: sidebar to every page, signed-in admin skips `/signin`, pillars open in a new tab, phone bottom tabs.
- `admin/forms.spec.ts`: Add event validation and Cancel, Settings tabs, theme kept after reload.

---

## 4. Implementation Tasks

- [x] Task 1: Vitest config, setup, unit and component tests.
- [x] Task 2: Playwright config, write guard, fixtures, public and admin specs.
- [x] Task 3: Scripts, `.gitignore`, `.env.local.example`, CI step.
- [x] Task 4: README and CLAUDE.md.

---

## 5. Verification & Rollout Plan

- [x] `npm run test`: 122 passed, about 6s.
- [x] Mutation check: breaking the `0917…` prefix handling, the APP2 exception in photo stripping, or the "serious" casualty rank each fails the tests (4 failures); restored.
- [x] Write guard against the live dev server (temporary spec, deleted): `createBystanderReport` was stopped in the browser with `TypeError: Failed to fetch` and never reached the server; `getBystanderIncidentTypes` went through; an unknown id was stopped.
- [x] `npm run test:e2e`, public project: 12 of 15 passed. The 3 bystander flows that need the lookup lists failed because the dev database couldn't be reached on 2026-10-13 (`aws-1-ap-south-1.pooler.supabase.com:5432` timed out, Prisma "Server has closed the connection"). They fail with "incident types load from the database; is it reachable?".
- [x] Admin project without a test login: 8 skipped with the reason.
- [x] `npm run lint`, `npm run type-check`, `npm run build`: pass. `npm audit --audit-level=critical`: pass (the 8 highs are the known next-pwa/shadcn `fast-glob` chain).

Rollout: merge. Each developer runs `npx playwright install chromium` once and, for the admin tests, adds the test login to `.env`.

Open items:

- [ ] Rerun the 3 bystander flows and the admin project once the dev database is reachable and a test admin exists.
- [ ] Create a dedicated test admin in Supabase (not a real person's account) and share the login with the team.
- [ ] ERT flows: ERT members sign in with Google, which can't be automated. A test ERT user with a password (Supabase admin API) would let `/report` be covered; its submit would be stopped by the guard like the bystander one.
- [ ] Optional: a Playwright job in CI once there is a test database and the login is in GitHub secrets.
