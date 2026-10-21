# DRRM-015 Feature Plan: Printable building assessment

- **Status:** Done
- **Target Branch / PR:** `feat/DRRM-015-assessment-form`
- **Owner / Author:** DevJom

---

## 1. Problem Statement & Motivation

- A submitted building assessment (`/assessment?view=<id>`) can only be read on screen. The
  assessment has to be printed (or saved as PDF) and signed by the **Assessor**, the **Safety
  Officer** and the **Incident Commander**.
- User: the ERT member who did the assessment (the view only shows the signed-in user's own
  assessments; admins have no assessment view yet).

---

## 2. Requirements & User Stories

- **As an ERT member**, I want to print a submitted assessment so that it can be signed and filed.
- Acceptance criteria:
  - [x] A **Print** button on the read-only view opens an A4 page and the browser's print dialog
        (its preview, and "Save as PDF" as a destination). Print, not a direct download.
  - [x] Title "Building Safety Assessment" (no "MATATAG"), the checklist version, the campus
        letterhead.
  - [x] Page 1: details, the follow-up notice, the scores (overall, three pillars, Public Service
        Continuity Plan), the unsafe items by pillar, the score by section.
  - [x] Then every applicable question with its answer (unsafe ones highlighted), remarks and
        section comments, in English with the Filipino under it whatever the device setting.
  - [x] Signatures: Assessor and Incident Commander names filled in from the record, Safety
        Officer blank (no field for it); each with "Signature over printed name" and a date line.
  - [x] "Page x of y" and the generated date on every printed page.

---

## 3. Architecture & Technical Design

### Data Model & Prisma

- None. It uses the record `getMyAssessment` already returns.

### Server Actions & Data Flow

- None new: `useMyAssessment(id)`; scoring through `scoreAssessment` / `applicableItems` as in the
  view.

### UI & User Interaction

- `?print=<id>` on the `/assessment` route (rendered without `ErtFrame`), so it keeps the ERT
  guard (`useErtAccess`) — the `(print)` group's `ProtectedRoute` sends ERT members to `/home`.
- `src/app/(ert)/assessment/_components/assessment-print.tsx` — the A4 page.
- `src/components/print/report-sheet.tsx` — the A4 frame (shell, sheets, letterhead, `@page`
  rules, toolbar) moved out of the event report so both reports share it.
- `Bilingual` takes an optional `language` that overrides the device setting (`'both'` on paper).

---

## 4. Implementation Tasks

- [x] Extract the print frame from `(print)/events/report/page.tsx`
- [x] `AssessmentPrint` and the `?print=` route branch
- [x] Print button on `AssessmentView`

---

## 5. Verification & Rollout Plan

- [x] Opened a submitted assessment, Print → `?print=<id>`, the dialog opens once; checked page 1,
      the unsafe highlighting and the signature row in the browser.
- [x] `npm run lint`, `npm run type-check`, `npm run test`, `npm run build`
- [x] Print on paper / save as PDF from Chrome on desktop and Android and check page breaks (checked by DevJom, 2026-10-21).
