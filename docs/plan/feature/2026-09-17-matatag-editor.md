# MATATAG checklist editor

- **Status:** In Progress — implementation verified; database rollout pending
- **Target branch:** MATATAG workspace

## Requirements and implementation

### Review request-change closure

- [x] Preserve invalid local drafts for recovery instead of overwriting them during initialization.
- [x] Invalidate individual record queries after save and create a fresh identity for new assessments.
- [x] Add schema-validated JSON draft import/export.
- [x] Keep Super Admin campus selection and historical inactive-unit values usable, while hiding inactive choices.
- [x] Expose section comments and assessed unit in the editor/print view.
- [x] Update the browser check for authenticated editor runs and unauthenticated route guards.

- [x] Add a Super Admin-only dashboard card and sidebar link to `/settings/matatag`.
- [x] Add, edit, and delete sections and questions, including English/Filipino wording, references, and group headings.
- [x] Add, remove, and edit answer options. Each option maps to Yes, No, or N/A for the existing scoring and summary rules; starred questions reverse which response earns a point.
- [x] Validate definitions and authenticate active Super Admins inside the publish server action. Database RLS and revoked browser grants prevent direct template writes.
- [x] Publish immutable checklist revisions. Unique revision numbers reject concurrent publishing; saved assessments and device drafts retain their original definition.
- [x] Use the selected definition throughout answering, validation, completion, totals, scores, draft recovery, and printing. Server saves reload the published definition to reject forged scoring metadata. Existing records cannot switch checklist versions.
- [x] Add campus assessment forms and routes: `/assessments`, `/assessments/matatag/[id]`, `/edit`, `/submit`, `/view`, and `/responses/[responseId]`. The MATATAG menu is grouped beside Settings with Default Template available to Super Admins.
- [x] Super Admins create campus forms from the default template. Campus Administrators can edit their campus copy, open/close responses, copy a signed-in campus-only submission link, and review responses. Multiple responses per user are supported; submitted responses are locked and can be reopened by the campus administrator or Super Admin.
- [x] Shared submission links require signed-in users assigned to the form's campus. Response drafts are scoped by user, form, and response ID.
- [x] Support PRE and POST assessment phases, with the main MATATAG form available to authorized users and restricted campus forms limited to designated active users.
- [x] Let Super Admins create restricted forms and manage their assigned audience; existing Super Admin template editing covers adding, editing, and deleting MATATAG sections and questions.
- [x] Add `/matatag/dashboard` for administrator metrics across General responses (`form_id = null`) and specific campus-form responses (`form_id != null`), scoped so Super Admins see all accessible data and Administrators see their campus.
- [x] Add building-by-building section score matrices with sequential A–Z/AA labels and a legend mapping each label to the real building, plus completion, phase, source, campus, section-performance, and detailed-response metrics.
- [x] Numbered subquestions (for example, 3.1–3.4) count as one grouped question. Any `No` makes the group `No`; otherwise a fully answered group is `Yes` (or `N/A` when every subanswer is `N/A`).

## Verification

- `npx tsx --test scripts/test-matatag.ts scripts/test-matatag-template-actions.ts "src/app/(public)/matatag/question-content.test.ts" "src/app/(public)/matatag/section-swipe.test.ts"`: 12 tests pass, including grouped-question aggregation, role restrictions, input validation, publication conflicts, custom options, historical snapshots, and canonical server scoring.
- TypeScript, targeted ESLint, and the production build pass. Full-repository lint has zero errors and existing formatting warnings; the build retains the existing sidebar package-version import warning.
- The build exposes `/assessments`, `/assessments/matatag/[id]`, `/edit`, `/submit`, `/view`, `/responses/[responseId]`, and `/assessments/matatag/template`.
- Browser verification with mocked server responses: section/question/option creation, editing, deletion, publishing, mobile layout, answering published custom questions, device-draft recovery, print coverage and custom answer labels, and Administrator denial. No live writes were made.

## Database rollout

If `/assessments` shows the schema-installation alert, see the [database schema bug report](../bugs/2026-09-17-matatag-database-schema-not-installed.md) for the preflight queries, rollout order, and index notes.

The read-only check confirmed that `public.matatag_assessments` and `public.matatag_templates` are absent in the configured database. Apply these additive SQL files, in order, through the controlled deployment process:

1. `prisma/migrations/20260915000000_add_matatag_assessments/migration.sql`
2. `prisma/migrations/20260917000000_add_matatag_templates/migration.sql`
3. `prisma/migrations/20260918000000_add_campus_matatag_forms/migration.sql`
4. `prisma/migrations/20260921000000_add_matatag_phases_and_assignments/migration.sql`

Do not replay the historical baseline migration against the existing database. `CLAUDE.md` disallows direct database modification commands. After rollout, regenerate the Prisma client, restart the app, and verify publication and assessment saves using authorized test accounts. Prisma client generation was already completed locally.
