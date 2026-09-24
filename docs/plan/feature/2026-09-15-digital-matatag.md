# Digital MATATAG assessment

- **Status:** In Progress
- **Target branch:** MATATAG workspace

## Scope

Digitize the supplied 26-page `[DRRM-H Copy] MATATAG Printable Form.pdf`, including assessment metadata, all 17 sections, 211 response items, bilingual wording, source references, remarks, section scores/comments, and overall score. Group prompts retain their wording and remarks; answers are recorded on their numbered subitems. The original PDF is available at `/matatag-reference.pdf`.

The source footer says version July 25, 2025, and the last page says updated June 29, 2026. Stored documents use checklist version `2026-06-29`. Scores are calculated as requested: positive items earn one point on Yes; starred negative items earn one point on No; every answered Yes, No, and N/A response is included in the denominator. Starred questions are preserved without adding other risk classifications.

## Implementation

- `/matatag`: responsive editor, section navigation, device recovery draft, JSON download/import, print view, shared draft save, validated completion.
- Mobile section navigation supports native horizontal swipes, gentle card snapping, a visible swipe hint, and previous/next navigation controls. Moving between form sections brings the selected card into view; reduced-motion preferences are respected.
- On mobile, a floating bottom Sections control opens the progress indicator and swipeable navigation in a Radix popover. The popover supports Escape/outside-click dismissal and closes on selection, returning focus to the new section heading. Desktop retains the sidebar. Bottom spacing accounts for the control and device safe area.
- Assessment IDs use native `crypto.randomUUID` when available and a UUID v4 fallback backed by `crypto.getRandomValues` otherwise. Both initial creation and starting another assessment use the same helper. Browser regression checks disable `randomUUID` and verify valid, distinct IDs and draft recovery.
- `/matatag/assessments`: authenticated records, search, pagination, reopen.
- Shared records are backed by `MatatagAssessment` and campus/user relations. JSONB stores the versioned form; indexed columns support campus/user scoping and recent-record queries.
- Server actions verify the Supabase access token using `auth.getUser`, check the active application user and allowed role, and enforce scope before any record access. ERT members access their own records; administrators access their campus; super admins access all campuses. Saves require an active campus; non-super-admins can save only within their assigned campus.
- Integer version checks prevent stale editors from overwriting newer records. The client keeps its draft after rejected or failed saves. A stable client-generated UUID prevents duplicate records on retry.
- Direct PostgREST/browser access is disabled with RLS and revoked anon/authenticated grants. Prisma uses the existing privileged server connection. Every server action must retain its authorization checks.
- Device drafts are keyed by account and record. Changed server records are loaded first; unsaved local changes require explicit restore or download. JSON import copies form content into the current editor without trusting imported record IDs or versions.

## Setup / rollout

1. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `DATABASE_URL`, and `SHADOW_DATABASE_URL` using the existing project environment. These settings became available during implementation and the final read-only database connection succeeded.
2. Review and apply **only** `prisma/migrations/20260915000000_add_matatag_assessments/migration.sql` through the project's controlled database deployment process. Do not blindly replay the historical initial migration against an existing database.
3. Run `npx prisma generate` and restart the app so its cached Prisma client includes the new model.
4. Verify shared creation, reopening, campus restrictions, simultaneous-edit conflict handling, and completion against a configured test database and authorized test accounts.

No database mutation was executed in this workspace. The existing `CLAUDE.md` disallows direct database modification commands. A local placeholder connection string was used only for Prisma client generation; no database connection is needed for that command.

The final read-only database check found neither `public.matatag_assessments` nor `public._prisma_migrations`. Shared saves therefore need the additive SQL above to be applied through an approved deployment process. Running `prisma migrate deploy` without first reconciling the existing database would attempt the historical baseline and is not appropriate.

## Validation

- `npx tsx --test scripts/test-matatag.ts`: passed 5 checks covering authorization scope, source coverage, cross-page continuation text, section N/A counts, input validation, and completion requirements.
- `npm run type-check`: passed. `npm run lint`: passed with 0 errors; the checkout has existing CRLF formatting warnings.
- `npm run build`: passed; an existing warning concerns the sidebar's named `version` import from `package.json`.
- `scripts/check-matatag-browser.cjs`: passed using a fresh, unauthenticated Edge context. Checks desktop/mobile/tablet layouts, questionnaire navigation, answer/remark recovery after reload, N/A toggle and restoration, JSON round trip, invalid import rejection, 17-section review, print coverage, and sign-in requirement for records.
- Live database writes and authenticated multi-account integration remain dependent on configured database access and migration rollout.
