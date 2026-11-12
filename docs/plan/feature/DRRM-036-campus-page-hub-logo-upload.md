---
type: feature
ticket: DRRM-036
status: done
branch: feat/DRRM-036-campus-page-hub-logo-upload
modules:
  - '[[campus-scoping]]'
  - '[[database]]'
  - '[[events]]'
tags: [plan, feature, design-round-2026-11-11]
---

# [DRRM-036] Feature Plan: Campus page: bigger logos, cards that fill, data first, quick exports, logo upload, campus hub

- **Status:** `[Done]`
- **Target Branch / PR:** `feat/DRRM-036-campus-page-hub-logo-upload`
- **Owner / Author:** Bryan Mangapit
- **Depends on:** DRRM-034 (header menu), DRRM-035 (CampusBackdrop)

> Design source: the screenshots below are the whole design. Don't open the Claude Design canvas for this ticket; it also holds older turns (1–8) that are already built.
> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`. Afterwards update the module notes listed in `modules:` and add a line to `docs/changelog.md`.

---

## 1. Problem Statement & Motivation

Super admins open the same event over and over: dashboard → Events → find the event → details. The Campus page goes unused.

The campus cards have small logos, uneven heights, and no ordering. There is no way to upload a campus logo.

---

## 2. Design

![SA54 campus list](../../design/2026-11-11-admin-polish/SA54-campus-list.png)

![SA55 add campus with logo](../../design/2026-11-11-admin-polish/SA55-add-campus-logo.png)

![SA56 campus details](../../design/2026-11-11-admin-polish/SA56-campus-details.png)

---

## 3. Requirements & Acceptance Criteria

**Campus list** (`src/app/(admin)/campus/page.tsx`)

- [x] Three sections, each with a heading and count:
  1. **With events**, most events first.
  2. **Set up, no events yet**: has population fields.
  3. **Not set up yet**: no population fields; keep today's warning.
- [x] Cards:
  - Logo 80px on "With events" cards, 56px on the others.
  - The grid uses `items-stretch` and cards are `h-full`, so cards in a row have equal heights.
  - "With events" uses 2 columns at lg; the other sections use 3.
- [x] A shared `CampusCard` (also used by the DRRM-038 dashboard) shows the latest event:
  - Name, status chip, date, reports and people.
  - Export PDF, plus NSED report where the template exists.
  - "Open event" instead of the exports while the event is ongoing.
  - The buttons must not trigger the card link.
- [x] `useCampusesOverview` / its action returns each campus's latest event.

**Logo upload** (`src/app/(admin)/campus/_components/campus-drawer.tsx`, used for both Add and Edit)

- [x] Logo field:
  - A 112px preview.
  - Choose file / Replace / Remove, plus drag and drop on web.
  - Accepts PNG, JPG and SVG.
- [x] The browser scales the image to 512×512 before upload, keeping transparency (WebP or PNG).
- [x] Storage and lookup:
  - New public Supabase Storage bucket `campus-logos`.
  - New column `campus.logo_path String?`, added via `prisma/manual/DRRM-036-campus-logo.sql` plus the `schema.prisma` edit. No `db push` (see `docs/modules/database.md`).
  - `campusLogo()` and `ownCampusLogo()` use the uploaded logo first, then the bundled `/public` file, then the UP seal.
  - Remove clears the column and deletes the file on save.

**Campus details** (`src/app/(admin)/campus/details/page.tsx`)

- [x] Header:
  - A 96px logo.
  - `CampusBackdrop` (from DRRM-035).
  - ⋯ menu: Edit campus, Population fields, then Delete campus (DRRM-034).
- [x] A row of counts, each a link:
  - Events (filtered to this campus)
  - Users (filtered)
  - Clusters, Units and Population fields (Settings, filtered)
- [x] Under the "Showing [event]" picker, an action row:
  - Export PDF (primary)
  - Export NSED report (where the template exists)
  - Complete event (while ongoing)
  - Open event details
- [x] The event summary below stays unchanged.

---

## 4. Technical Design

- Campus model: [`prisma/schema.prisma`](../../../prisma/schema.prisma); storage via [`src/lib/supabase-admin.ts`](../../../src/lib/supabase-admin.ts) only for what Prisma can't do. The upload path follows the report photos' pattern (`src/components/ds/photo-field.tsx`).
- [`src/lib/campus-logo.ts`](../../../src/lib/campus-logo.ts): async lookup or pass `logo_path` in the campus data so components stay sync.

---

## 5. Implementation Tasks

- [x] Overview action returns the latest event per campus; sort and sections
- [x] `CampusCard` with quick exports
- [x] Logo field + resize + storage bucket + SQL + `campusLogo()` order
- [x] Campus details: counts row, event action row, ⋯, backdrop
- [x] Update `docs/modules/campus-scoping.md` and `database.md`

---

## Notes from the build

- **Apply `prisma/manual/DRRM-036-campus-logo.sql`** (column `campus.logo_path` and the public `campus-logos` bucket) on staging and production. The code is safe to deploy first: `logo_path` is left out of default reads (`omit` in `src/lib/prisma.ts`) and `getCampusLogos` tolerates a missing column, so campuses keep loading and logos fall back to the bundled ones; uploading says the database update is missing.
- `setCampusLogo` checks the caller's token (Super Admins only), unlike the older campus actions.
- The count links set the top-bar campus to this campus before opening the list, because every list is scoped by the switcher (no per-page campus filters).
- `CompleteEventDialog` moved to `events/_components/` so the campus page can use it.
- Checked in a temporary preview with sample data (the dev database was unreachable): the three sections and equal card heights at 1280 px, phone at 390 px (no sideways scroll), the campus page counts and event actions on phone, and Add campus with a logo chosen (scaled to 512 × 512, 61 KB). The upload to Storage itself needs the SQL and a signed-in session: check it on staging.

## 6. Out of Scope

- Administrator access to their own campus page: DRRM-037.
