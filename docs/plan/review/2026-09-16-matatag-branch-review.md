# MATATAG branch review

## Findings

### [P1] Inherit negative scoring from the parent question — `src/lib/matatag.ts:83`

The starred question `VI-1` asks whether walls have visible cracks, but its seven answerable children (`VI-1.1` through `VI-1.7`) have `starred: false`. The scoring loop excludes the parent and checks only each child's flag, so reporting cracks earns points and reporting no cracks earns none. A runnable check against `matatagScore` reproduced **100% for seven YES answers and 0% for seven NO answers**. This affects the section score, overall score, printed assessment, and canonical scores persisted by `saveMatatagAssessment`. Resolve the parent's polarity when scoring subitems and cover this group in the scoring test; the existing test exercises only standalone negative questions.

### [P1] Preserve rejected recovery drafts before autosaving a replacement — `src/app/(public)/matatag/matatag-form.tsx:214`

The editor autosaves every input change, including values that fail the document schema, but reload accepts a draft only if the entire document passes that schema. Entering `0` or a fractional building/floor count is possible in the number input; after reloading `/matatag`, parsing rejects the draft, initialization creates an empty assessment, and the storage effect at lines 286–296 overwrites the same key. All other answers and remarks in the rejected draft are lost. The parser rejection was reproduced with a serialized draft containing `buildingCount: '0'` and otherwise valid answers. Preserve the original draft for recovery/download and keep validation errors from causing replacement of the stored work.

### [P2] Refresh the individual record cache after saving — `src/components/hooks/use-matatag.ts:57`

Saving invalidates `matatag-records`, but leaves `['matatag-record', user.id, id]` unchanged. Open a shared assessment at version 1, save version 2, return to Shared records, and reopen it: the application's 60-second `staleTime` permits version 1 to be reused without a request. Initialization also ignores subsequent query results once `initialized.current` is set, so a background refetch does not reliably repair the editor. The user sees old content and the next save fails the optimistic version check. A check using the installed `QueryClient` confirmed that the current invalidation leaves version 1 fresh and skips the fetch for version 2. Update the individual cache from the save response and ensure reopening initializes from a current record without overwriting unsaved edits.

### [P2] Make “New assessment” create a new assessment identity — `src/app/(public)/matatag/assessments/page.tsx:29`

The records page's “New assessment” link only navigates to `/matatag`. That route unconditionally restores `matatag-v1:<account>:new`, including its saved ID and version. Create and save assessment A on `/matatag`, visit Shared records, then click “New assessment”: A is restored, and saving changes updates A instead of creating B. The actual reset exists only in the editor's separate `startNewAssessment` button. Route the records-page action through an explicit new-assessment flow while preserving or confirming replacement of an unsaved recovery draft.

### [P2] Provide a way to import downloaded recovery drafts — `src/app/(public)/matatag/matatag-form.tsx:608`

The UI offers JSON downloads and instructs users to download their draft when storage or shared saving fails, but the editor contains no file input or import handler; its only `JSON.parse` reads local storage. A downloaded assessment therefore cannot be reopened through the application on another device or after device storage is lost. This also contradicts the JSON round-trip workflow in the feature plan and browser check. Add a schema-validated import path that copies document content while retaining the destination editor's record identity/version.

### [P2] Allow super admins to select an authorized campus — `src/app/(public)/matatag/matatag-form.tsx:148`

`isCampusLocked` locks the campus selector for every signed-in user with a campus assignment, including Super Admins. For a Super Admin assigned to campus A, the server returns all active campuses and permits saving to campus B, but the UI prevents selecting B; the profile synchronization effect also forces A into new assessments. Apply the campus lock and forced campus synchronization according to role so the server-supported cross-campus workflow is reachable.

### [P2] Expose the section comments stored by the document model — `src/app/(public)/matatag/matatag-form.tsx:960`

Each section's schema and print output support `comments`, and the feature plan includes section comments, but the section editor ends after item remarks without any control bound to `document.sections[section.id].comments`. The sole `updateSection` caller changes `notApplicable`; a new assessment cannot acquire section comments through the form, and existing comments cannot be corrected there. Add a section-level comment input using the existing update function, including when the whole section is marked N/A.

### [P2] Include the assessed unit in the printed document — `src/app/(public)/matatag/matatag-form.tsx:1139`

The print view renders campus and then the shared `fields` array, but that array omits `unit` because the editor renders it separately. Consequently the required College / department / unit value is absent from every printed assessment, even when present in the saved document. Include `document.details.unit` explicitly in the print metadata so the output identifies the organization being assessed.

### [P2] Hide inactive units from the assessment selector — `src/app/(public)/matatag/matatag-form.tsx:176`

`useCampusClusters` returns both active and inactive clusters, and `sortedClusters` maps every returned row into selectable `<option>` elements. The MATATAG form therefore lets an evaluator choose a retired/inactive unit and persists its name in `document.details.unit`; the server validates only free text and cannot reject that stale choice. Existing admin forms filter these rows by `is_active` before presenting them. Filter the MATATAG options to active clusters while retaining an existing inactive value only when reopening historical data.

### [P2] Update the browser check for the authenticated editor — `scripts/check-matatag-browser.cjs:24`

The browser check creates a fresh unauthenticated context and immediately waits for the assessment editor. The new MATATAG layout redirects that context to `/signin`, so the check cannot reach its first form assertion. Later assertions also reference the obsolete `matatag-v1:guest:new` key, an absent import control, and an absent “Sign in to view shared records” heading; the remarks textarea is inside a closed `<details>` element that the script never opens. Provide an isolated authenticated test setup for editor checks and a separate assertion for the current unauthenticated redirect, then update the selectors and recovery expectations. The feature plan's prior browser-pass claim does not validate this version of the UI.

## Overall assessment

**Request changes:** 2 P1 findings and 8 P2 findings. Incorrect negative-question scoring and recovery-draft data loss should be fixed before release. The server actions verify identity, check active accounts and supported roles, scope record reads/updates, validate inputs, and use version-checked updates; no additional concrete authorization defect was established in this review.

## Scope and verification

- **Status:** Done — review and report completed; findings remain open.
- **Review date:** 2026-09-16.
- **Branch:** `feat/MATATAG`.
- **Comparison:** `dev`, at `5d83deb07b6d3406b01f5ec892f1cee656aee552`. `origin/dev` resolves to the same commit; local `dev` has no configured upstream. `git merge-base HEAD dev` returns that commit.
- **Reviewed snapshot:** HEAD equals the base. The implementation is entirely in the working tree, so this review includes the seven modified tracked files and all listed untracked feature code, scripts, migration, documentation, and assets. It is not a review of an already committed feature diff.
- **Instructions:** No applicable `AGENTS.md` was found in the workspace or ancestor directories. Reviewed `CLAUDE.md`, the local Ponytail rules, the feature plan, and the docs conventions. Application code was left unchanged; this report is the requested documentation addition.

| Check                                                                                                                                         | Result                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsx --test scripts/test-matatag.ts "src/app/(public)/matatag/question-content.test.ts" "src/app/(public)/matatag/section-swipe.test.ts"` | Passed: 8 tests.                                                                                                                                                                     |
| `npm run type-check`                                                                                                                          | Passed.                                                                                                                                                                              |
| `npm run lint`                                                                                                                                | Passed with 0 errors and 15,420 warnings, predominantly formatting/line-ending warnings.                                                                                             |
| `npm run build`                                                                                                                               | Passed; warns about the existing named `version` import from `package.json`.                                                                                                         |
| `npx prisma validate`                                                                                                                         | Passed; the Prisma schema is valid.                                                                                                                                                  |
| Targeted read-only assertions                                                                                                                 | Reproduced reversed `VI-1` child scoring, rejection of an autosaved invalid-count draft, and stale individual-record caching after list-only invalidation.                           |
| `scripts/check-matatag-browser.cjs` with `MATATAG_BASE_URL=http://localhost:3001` and the available Playwright/Edge runtime                   | Failed at line 25: timed out waiting for the assessment heading. A separate fresh-browser check confirmed redirect to `/signin?from=%2Fmatatag` and zero assessment-editor headings. |

The existing tests cover score arithmetic for standalone negative items, pure authorization scope helpers, document validation, checklist coverage, bilingual content consistency, and swipe calculations. They do not exercise the editor's draft lifecycle, inactive-unit choices, or authenticated record-cache lifecycle. The targeted cache check used the installed TanStack Query implementation; the draft-overwrite, inactive-option, and new-record consequences were traced through the editor and save action rather than through live database writes.

No migrations or database writes were executed. Migration deployment, actual database privileges/RLS, authenticated cross-account behavior, simultaneous saves, and authenticated browser end-to-end flows remain unverified. The existing feature plan documents migration rollout as a prerequisite; this review does not assert the current live database state or independently certify the checklist's source regulations.
