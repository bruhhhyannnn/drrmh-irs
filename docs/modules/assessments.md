---
type: module
module: assessments
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

**Related:** [[architecture]] · [[assessment-admin]] · [[checklist-editor]] · [[building-safety]] · [[offline-pwa]] · [[print]] · [[auth-and-profiles]] · [[data-layer]]

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
- `getTemplateVersion(versionId)`: any version by id, for drafts started on an older one.
- `getAssessmentSetup(campusId)`: active clusters with units, active buildings with profile and last assessed date, and events that are ongoing or completed in the last 30 days.
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
