---
type: feature
ticket: DRRM-044
status: in-progress
branch: feat/DRRM-044-structural-integrity
modules:
  - '[[assessments]]'
  - '[[assessment-admin]]'
  - '[[print]]'
  - '[[database]]'
tags: [plan, feature]
---

# [DRRM-044] Feature Plan: Structural integrity in the building assessment

- **Status:** `[In Progress]`
- **Target Branch / PR:** `feat/DRRM-044-structural-integrity`
- **Owner / Author:** DevJom

> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`.

---

## 1. Problem Statement & Motivation

DRRM-H was given a research tool for checking a building's structural integrity and wants it in the ERT assessment form: the **Rapid Condition Assessment Tool (RCAsT), Material Component** (Orozco et al., UP Diliman Institute of Civil Engineering, 1st Regional Conference on Natural Disaster, 2014; form revised 3/5/13).

The MATATAG checklist answers every question Yes / No / N/A. The open question was whether the structural part can do the same. It can't on its own: the tool's rating needs, for every defect that is present, how bad it is and how widespread it is. So each check starts as Yes / No / N/A, and a Yes opens two more choices.

Users: ERT Members fill it in. Administrators and Super Admins read the result on the assessment's detail page and its printout.

---

## 2. What the tool is

- **Ten defect types** (the form's rows 1.1 to 2.2), each with a basic value B1: 1, 3, 1, 1, 1, 2, 3, 2, 1, 3 (sum 18).
- **Four elements**, each with a factor K1: columns 1.2, beams 1.1, floor slabs 0.3, walls 0.
- **K2, intensity** (Tables A3 and A4) and **K3, extent** (Table A5): four steps each, worth 0.5, 1, 1.5 and 2.
- **K4, urgency of intervention** (Table A6): 1 to 5.
- **Local condition rating** per element: `LCR = Σ(B1 · K2 · K3 · K4) / 72 × 100%`. The 72 is every defect at its worst with K4 = 1 (18 × 2 × 2), as the form's note says.
- **Global condition rating**: `GCR = (1.2 LCRcolumns + 1.1 LCRbeams + 0.3 LCRslabs) / 2.6`.
- **Recommendation**: no further action, detailed local investigation, or overall further investigation (Level 2) when the rating is above 15%.
- **Critical members** (the form's footnote): lengthwise cracks on columns, crosswise cracks at midspan on beams, diagonal cracks on walls.

A higher rating means more deterioration, the opposite of the MATATAG safe-answer percent.

---

## 3. Requirements & Acceptance Criteria

- [x] After the checklist sections, the form has four structural steps (Columns, Beams, Floor slabs, Walls), then Review.
- [x] Each step asks the ten defects as Yes / N/A / No, in English and Filipino, with the form's own term under each question.
- [x] A Yes opens "How bad is it?" (four choices from Table A4, or Table A3 where A4 says general criteria) and "How widespread is it?" (four choices from Table A5). The check isn't finished until both are chosen.
- [x] Columns, beams and walls end with their critical-crack check (Yes / N/A / No).
- [x] "Mark the rest No" and "Mark the rest N/A" answer what is still blank on the page, so a sound element takes one tap.
- [x] On phones (below `lg`) the structural steps go one question at a time, like the checklist's flashcards: large YES / N/A / NO buttons, No and N/A move on at once, Yes moves on once both grades are chosen, and "Mark the rest" moves to the next element. Back / Next and the Questions drawer's numbered chips step through the checks. Desktop keeps the full list.
- [x] On phones, changing questions is animated for the checklist and the structural steps alike (`assessment-stepper.tsx`): the tapped answer shows its check for 180 ms before moving on, and the next card slides in from the right (from the left going back) in 220 ms. With "reduce motion" on, it only fades. Any other move cancels a pending one.
- [x] Review shows the rating so far and blocks Submit while a structural check is unanswered, listing the elements with what is left.
- [x] The server re-checks the answers and works out the ratings itself; it never trusts numbers from the phone.
- [x] An assessment's view, admin detail page and A4 printout show the recommendation, the rating per element and the defects found.
- [x] The existing "Needs follow-up" flag is also raised when the tool recommends an investigation.
- [x] Drafts and queued assessments from before this ticket still work: an old queued one submits without a structural part; an old draft gains the four steps.

---

## 4. Decisions

- **K4 stays at 1.** Urgency is an engineer's judgement (when a repair is due), so ERT members aren't asked for it. It is the value the form uses for its own maximum. Effect: serious damage on a single member rates low (one column with exposed, spalling steel is about 4%), so the critical-crack checks matter. To confirm with the tool's authors or DRRM-H's engineer.
- **A critical crack asks for a local investigation of that element whatever its rating.** The form only says to "consider the component critical"; treating that as an investigation is our reading.
- **An element over 15% asks for a local investigation; the building over 15% asks for the overall one.** The paper says the recommendation rests on both ratings.
- **Walls are rated but not counted** in the building rating (K1 = 0), as on the form. A wall rating over 15% still asks for a local investigation.
- **N/A scores nothing**, like a blank cell on the paper form. An element answered N/A throughout reads "Not assessed".
- **The tool is fixed data in code, not part of the versioned checklist** ([[0011-structural-tool-in-code]]). Its formula depends on exactly these ten rows.
- **The result is shown beside the MATATAG score, not blended into it.** They run in opposite directions.
- **Not built:** the paper form's sketch of the building frame, photos of defects, an engineer's review step, and a structural column in the admin lists and dashboard.

Wording to confirm with the tool's authors: row 1.5 (Light / Medium / Heavy / Severe have no definitions), row 1.8 (the gap widths were garbled in the PDF), row 2.2 ("10% of the bar lost" is hard to judge by eye), and the top two steps of Table A3, which overlap (25–75% and over 50%). The Filipino wording is a first draft and needs a native speaker's check.

---

## 5. Architecture & Technical Design

### Data Model & Prisma

Two new tables, in [prisma/manual/DRRM-044-structural-integrity.sql](../../../prisma/manual/DRRM-044-structural-integrity.sql). Nothing changes on existing tables, so older code and older assessments are unaffected.

```prisma
model AssessmentStructuralSummary {   // assessment_structural_summaries, one row per assessment
  assessment_id    String @id
  tool_version     String             // STRUCTURAL_TOOL_VERSION
  lcr_columns … lcr_walls, gcr Float  // percent, higher is worse
  critical_columns, critical_beams, critical_walls AssessmentAnswer?
  recommendation   String             // 'none' | 'local' | 'overall'
}

model AssessmentStructuralFinding {   // assessment_structural_findings, one row per element and defect
  assessment_id, element, defect_code
  answer   AssessmentAnswer
  severity Int?  // 1–4, only when the answer is yes
  extent   Int?
  remarks  String?
}
```

### Shared logic

[src/lib/structural-integrity.ts](../../../src/lib/structural-integrity.ts): the elements, the ten defects with their wording and choices, `structuralProgress`, `structuralInputFromDraft` / `structuralDraftFromInput`, `rateStructural` and the server's `prepareStructuralWrite`. Tests in `structural-integrity.test.ts` check the numbers against the form.

### Server Actions & Data Flow

- `assessmentPayloadSchema` gains an optional `structural: { findings, critical }`. It rides in the one `createAssessment` payload, so the offline queue replays it unchanged ([[0004-offline-queue-bundled-create]]).
- `createAssessment` runs `prepareStructuralWrite`, refuses a payload with checks missing, writes the summary and findings in the same transaction, and sets `needs_follow_up` when the recommendation isn't "none". A missing table (the SQL hasn't run) comes back as a clear message.
- `loadAssessmentRecord` reads the structural part with its own queries and returns `structural: null` when there is none or the tables are missing, so older assessments keep opening.

### UI & User Interaction

- `AssessmentDraft.structural` and four `structural:<element>` steps (`draftSteps`, `structuralElementOf`).
- `structural-step.tsx`: one element's checks. `structural-summary.tsx`: the result (`StructuralSummary`) and every answer (`StructuralAnswers`). `structural-print.tsx`: the A4 section.
- Wired into `assessment-stepper.tsx`, `section-index.tsx` (the Questions drawer), `review-step.tsx`, `assessment-view.tsx` (also the admin detail body), `assessment-print.tsx` and the draft progress in `assessment-hub.tsx`.

---

## 6. Implementation Tasks

- [x] Task 1: `structural-integrity.ts` and its tests
- [x] Task 2: payload schema, draft, steps and their tests
- [x] Task 3: SQL file and `schema.prisma`
- [x] Task 4: `createAssessment` and `loadAssessmentRecord`
- [x] Task 5: the four steps, the review, the view and the printout
- [x] Task 6: docs (this plan, [[assessments]], [[database]], [[glossary]], decision 0011)

---

## 7. Verification & Rollout Plan

- [x] `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`
- [ ] Apply `prisma/manual/DRRM-044-structural-integrity.sql` to the development database
- [ ] In the browser as an ERT Member: fill an assessment through the four structural steps, submit, open the view and the printout; then check the admin detail page
- [ ] Submit one offline and let it send
- [ ] Apply the SQL to staging and production before deploying
- [ ] When it merges: add a line to [[changelog]] and set this plan to `done`
