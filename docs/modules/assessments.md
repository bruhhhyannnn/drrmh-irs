---
type: module
module: assessments
updated: 2026-10-28
verified: true
paths:
  - src/app/(ert)/assessment
  - src/app/(ert)/_components
  - src/app/(ert)/_lib
  - src/actions/assessments
  - src/components/assessment
  - src/lib/assessment-template.ts
  - src/lib/assessment-score.ts
  - src/lib/assessment-draft.ts
  - src/lib/assessment-caller.ts
  - src/lib/question-language.ts
  - src/components/hooks/use-assessments.ts
  - prisma/data
  - prisma/seed-matatag.ts
tags: [module]
---

# Building assessment (ERT side)

ERT members fill in the MATATAG building safety checklist (DRRM-015) on their phones at `/assessment`. A draft lives on the phone until it is submitted; a submit made offline goes to the offline queue. The server re-checks every submit, scores it by DRRM pillar and stores it against the checklist version it was answered with. Admins read the results through [[assessment-admin]] and [[building-safety]].

**Related:** [[architecture]] · [[assessment-admin]] · [[checklist-editor]] · [[building-safety]] · [[offline-pwa]] · [[print]] · [[auth]] · [[database]] · [[routes]]

## Essentials

Read this before touching anything in the MATATAG assessment (DRRM-015). Admin pages: [[assessment-admin]]. Checklist editor: [[checklist-editor]]. Dashboard rollup: [[building-safety]].

- **Template in the database:** the building safety checklist is a versioned template ([[0006-versioned-checklist-template]]):
  - `assessment_templates` → `assessment_template_versions` → `assessment_sections` → `assessment_items`.
  - Only one version is `published` at a time, and an assessment keeps the version it was answered with.
  - Group parents are unscored and hold the shared prompt. Every scored item has one DRRM pillar.
- **Buildings:** a building belongs to a unit and keeps a profile (floors, `building_areas`) that pre-fills its next assessment. Buildings are fixed on the Settings → Buildings tab, the shared lookup table ([[settings-lookups]]).
- **Seed:** the checklist text is seeded from `prisma/data/matatag-2025-07-25.ts` by `npm run seed:matatag`. The seed can be re-run safely: it matches by code and never deletes, so item ids stay stable ([[database]]).
- **Shared pure logic** in `src/lib`, used by the form, the server and the tests:
  - `assessment-template.ts`: types, and `templateFromData` for tests.
  - `assessment-score.ts`: which items apply for the floors and areas, scoring, and `prepareAssessmentWrite`, the server's re-check of a submit.
  - `assessment-draft.ts`: the draft kept on the phone, and its payload.
- **One route:** `/assessment` is the hub, `?draft=<client_ref>` the stepper, `?view=<id>` the read-only view, and `?print=<id>` that assessment on A4. The print view renders without `ErtFrame` but keeps the ERT guard. Everything stays on one route because the service worker might not cache a dynamic segment for offline use ([[0005-assessment-single-route]], [[routes]]).
- **A4 frame:** sheets, letterhead and `@page` rules are in `src/components/print/report-sheet.tsx`, shared with the `(print)` event report ([[print]]). On paper, `<Bilingual language="both">` ignores the device setting.
- **Who can use it:** decided only by `canUseAssessment()` in `src/lib/access.ts`. The `/home` card, the Report | Assessment switch, the page guard and the server action all call it.
- **Caller check:** unlike the older actions, `src/actions/assessments` doesn't trust a client-sent user id. It takes the Supabase access token (`getAccessToken()` in `src/lib/supabase.ts`), verifies it with `requireProfile(token)` from `src/lib/server-auth.ts`, and uses that profile as the evaluator ([[0007-token-verified-actions]]).
- **Failures:** expected failures come back as `{ ok: false, error, retry }` instead of being thrown, because thrown messages are hidden in production. `retry: true` (signed out, or another account on the phone) keeps an offline entry pending.
- **Language:** question text follows the per-device "Checklist language" set in My profile (`useQuestionLanguageStore`, rendered through `<Bilingual>`).
- **Offline:** drafts live in the IndexedDB `assessment-drafts` store, and the checklist and form setup in `assessment-cache` ([[offline-pwa]]).
- **Admin side:**
  - Admins read assessments through `src/actions/assessment-admin`, where each action calls `requireAdmin(token, campusId)` ([[assessment-admin]]).
  - Shared server-only loaders are in `src/lib/assessment-records.ts`, and the score arithmetic in `src/lib/building-safety.ts` ([[building-safety]]).
  - The Super Admin edits the checklist at `/assessments/checklist` ([[checklist-editor]]).

## Where it lives

| Path                                                                   | What it holds                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(ert)/assessment/page.tsx`                                    | The one route: hub, `?draft=`, `?view=`, `?print=`                                                                                                                                                             |
| `src/app/(ert)/assessment/_components/`                                | `AssessmentHub`, `AssessmentStepper`, `DetailsStep`, `BuildingStep`, `SectionStep`, `SectionIndex`, `ReviewStep`, `ScoreSummary`, `AssessmentView` / `AssessmentRecordBody`, `AssessmentPrint` / `RecordPrint` |
| `src/app/(ert)/assessment/_lib/nav.tsx`                                | `goToAssessment`, `AssessmentLink` (move inside the route with `history.pushState`)                                                                                                                            |
| `src/app/(ert)/_components/`                                           | `ErtFrame`, `TopBar` (Report / Assessment switch), `WaitingToSend`, `chrome.tsx` blocks                                                                                                                        |
| `src/app/(ert)/_lib/`                                                  | `useErtAccess`, `useQueuedAssessments`, `useFieldQueue`, `format.ts`                                                                                                                                           |
| `src/actions/assessments/index.ts`                                     | Server actions: template, setup, submit, own assessments                                                                                                                                                       |
| `src/components/assessment/`                                           | `Bilingual`, `QuestionLanguageSetting` (shown in the profile drawer)                                                                                                                                           |
| `src/lib/assessment-template.ts`                                       | Types, `PILLAR_CODES`, `AREA_CODES`, `templateFromData`, `itemLabel`                                                                                                                                           |
| `src/lib/assessment-score.ts`                                          | `applicableItems`, `scoreAssessment`, `percent`, `recoveryStatus`, `prepareAssessmentWrite`                                                                                                                    |
| `src/lib/assessment-draft.ts`                                          | `AssessmentDraft`, `newDraft`, `draftSteps`, `toPayload`, `draftFromPayload`, search and filters                                                                                                               |
| `src/lib/assessment-caller.ts`                                         | `checkAssessmentCaller`: who may submit a queued payload                                                                                                                                                       |
| `src/lib/access.ts`                                                    | `canUseAssessment`: the one access rule                                                                                                                                                                        |
| `src/lib/question-language.ts`, `src/store/question-language.store.ts` | Per-device checklist language                                                                                                                                                                                  |
| `prisma/data/matatag-2025-07-25.ts`, `prisma/seed-matatag.ts`          | Checklist text and its idempotent seed (`npm run seed:matatag`)                                                                                                                                                |

## Data

- `Assessment` (`assessments`): `client_ref` (unique, the draft id on the phone), `template_version_id`, `building_id`, `event_id`, `evaluator_id`, `incident_commander`, `floor_count`, `started_at`, `ended_at`, `needs_follow_up`. Immutable after submit.
- `AssessmentArea` (`assessment_areas`), `AssessmentAnswerRow` (`assessment_answers`, `answer` yes/no/na or null plus `remarks`), `AssessmentSectionComment` (`assessment_section_comments`), `AssessmentPillarScore` (`assessment_pillar_scores`: `safe_count`, `counted_count`, `na_count`, four rows per assessment).
- `Building` (`buildings`): `unit_id`, `name`, `floor_count`, `is_active`. `BuildingArea` (`building_areas`) is the current profile used to pre-fill the next assessment.
- Reads the template tables (`AssessmentTemplateVersion`, `AssessmentSection`, `AssessmentItem`, `BuildingAreaType`, `DrrmPillar`) through `loadVersion` in `src/lib/assessment-records.ts`.
- Reads `Cluster`, `Unit`, `Event` for the Details step.

## Server actions

`src/actions/assessments/index.ts`:

- `getPublishedTemplate()`: the version new assessments use.
- `getTemplateVersion(token, versionId)`: any non-draft version by id, for drafts started on an older one. Signed-in callers only.
- `getAssessmentSetup(token, campusId)`: only for the caller's own campus (empty otherwise). Active clusters with units, active buildings with profile and last assessed date, and events that are ongoing or completed in the last 30 days.
- `createAssessment(token, payload)`: verifies the token with `requireProfile`, then `checkAssessmentCaller` (owner, `canUseAssessment`, has campus). Validates with `assessmentPayloadSchema`, returns the existing id when `client_ref` already landed, refuses draft versions, re-checks with `prepareAssessmentWrite`, resolves or creates the building in the caller's campus, then writes the assessment, its rows and pillar scores in one transaction and replaces the building's profile.
- `getMyAssessments(token)`: the caller's last 50, newest first.
- `getMyAssessment(token, id)`: one of the caller's own, via `loadAssessmentRecord`.

## Client side

- Route `/assessment` (hub), `/assessment?draft=<client_ref>` (stepper), `?view=<id>` (read-only), `?print=<id>` (A4, no `ErtFrame`). `/home` shows the Assessment card when `canUseAssessment` is true.
- Hooks in `use-assessments.ts`: `useAssessmentTemplate`, `useTemplateVersion`, `useAssessmentSetup`, `useAssessmentDrafts`, `useMyAssessments`, `useMyAssessment`, `useSubmitAssessment`.
- Stores: `useQuestionLanguageStore` (`both` / `en` / `fil`, localStorage key `irs-question-language`), `useOfflineQueueStore`, `useAuthStore`.
- Drafts are saved with `saveAssessmentDraft` (IndexedDB `assessment-drafts`). The template and setup are cached in `assessment-cache` through `cachedFetch`, with a 6 s slow-network fallback.

## Rules and gotchas

- Access is decided only by `canUseAssessment()` (today: user type "ERT Member"). The `/home` card, the top-bar switch, `useErtAccess({ requireAssessment: true })` and `checkAssessmentCaller` all call it.
- Never trust a client user id. The evaluator is the verified token's profile; the payload's `evaluator_id` must match it.
- Expected failures return `{ ok: false, error, retry }`. `retry: true` (signed out, another account on a shared phone) keeps a queued entry pending; any other refusal marks it `failed`.
- `client_ref` dedupes replays. A unique violation on insert is treated as already saved.
- Answers that stop applying after a floor or area change stay in the draft ("set aside"); only `toPayload` drops them.
- The submit times out after 20 s and goes to the queue. A refused queued entry can be retried (`retryQueuedAssessment`) or reopened as a draft (`draftFromPayload`, same `client_ref`).
- New buildings match an existing one by unit and case-insensitive name (`uq_buildings_unit_name`).
- Moving between hub, draft and view uses `history.pushState`, not `router.push`, so it works offline.
- `npm run seed:matatag` matches by code and never deletes, so item ids on phones stay valid.

## Decisions

- [[0005-assessment-single-route]] one `/assessment` route with query params so the service worker can cache it.
- [[0006-versioned-checklist-template]] each assessment keeps the version it was answered with.
- [[0007-token-verified-actions]] submit and own reads verify the Supabase token server-side.
- [[0004-offline-queue-bundled-create]] the whole assessment replays as one `createAssessment` payload.
- [[0001-server-actions-only]] all reads and writes go through `src/actions/assessments`.
