---
type: feature
ticket: DRRM-041
status: done
branch: feat/DRRM-041-favicon-app-icons
modules:
  - '[[offline-pwa]]'
tags: [plan, feature, design-round-2026-11-11]
---

# [DRRM-041] Feature Plan: Favicon and installed-app icons

- **Status:** `[Done]`
- **Target Branch / PR:** `feat/DRRM-041-favicon-app-icons`
- **Owner / Author:** Bryan Mangapit

> Design source: the screenshots below are the whole design. Don't open the Claude Design canvas for this ticket; it also holds older turns (1–8) that are already built.
> Rules: follow `CLAUDE.md` (server actions only, theme tokens with no `dark:`, Prettier). Before the PR run `npm run lint`, `npm run type-check`, `npm run test` and `npm run build`. Afterwards update the module notes listed in `modules:` and add a line to `docs/changelog.md`.

---

## 1. Problem Statement & Motivation

The current icon setup has these problems:

- The favicon is the full 3375px, 1.45 MB logo.
- There is no maskable icon for Android and no apple-touch-icon for iPhone.
- The theme colour is black.
- About 24 MB of campus logos are precached on every phone.

---

## 2. Design

![9h favicon and app icon findings](../../design/2026-11-11-admin-polish/9h-app-icons.png)

---

## 3. Requirements & Acceptance Criteria

**Favicon** (`src/app/layout.tsx`)

- [x] Add `src/app/favicon.ico` (16, 32 and 48px) and `src/app/icon.png` (512×512). Next.js links them on its own.
- [x] Remove `icons.icon` from the metadata.
- [x] Add `src/app/apple-icon.png`: 180×180, the shield on white.
- [x] Add `appleWebApp: { title: 'IRS', capable: true }` to the metadata.

**Manifest** (`public/manifest.json`)

- [x] Add `public/icon-maskable-512.png`: the shield within the middle 80%, on maroon or white, with `"purpose": "maskable"`.
- [x] Keep the 192 and 512 icons.
- [x] Add `id: "/"`, `scope: "/"` and a `description`.
- [x] Set `theme_color` to `#a11d1d` or white.

**Theme colour** (`src/app/layout.tsx`)

- [x] `viewport.themeColor`: one value per colour scheme. Light: `#ffffff` or `#a11d1d`. Dark: `#0c111d`.

**Start URL**

- [x] `start_url` goes to `/signin`, which forwards signed-in users. Keep `/` only if it already redirects signed-in users.

**Precache size**

- [x] Resize `public/up-*-logo.png` to 512px (currently 0.8–5.8 MB each), or add them to next-pwa `publicExcludes` in `next.config.ts`.
- [x] Check `upm-drrmh-background-*.jpg` the same way.

---

## 4. Technical Design

- [`src/app/layout.tsx`](../../../src/app/layout.tsx), [`public/manifest.json`](../../../public/manifest.json), [`next.config.ts`](../../../next.config.ts). Rebuild and check Lighthouse's PWA / installability panel and an Android and iPhone home-screen icon.

---

## 5. Implementation Tasks

- [x] Icons and metadata
- [x] Manifest
- [x] Logo sizes / precache
- [x] Update `docs/modules/offline-pwa.md`

---

## Notes from the build

- The icons are drawn from the existing 512 px shield (`public/icon-512x512.png`): the favicon and `icon.png` transparent, `apple-icon.png` on white, the maskable icon on maroon (`#a11d1d`) with the shield at 58% so it stays inside the safe circle.
- `start_url` is `/signin`, since `/` (the landing page) doesn't forward signed-in users; `id: "/"` keeps an app already installed from `/` the same app.
- The logos were resized rather than excluded from the precache, so they still load offline. `irs-logo.png` (3375 px, 1.45 MB) was resized too, since every page shows it at 96 px or less. The background photos keep their size (1600 px) and were re-encoded where that saved over 20%.
- Not checked here: Lighthouse's installability panel and real Android and iPhone home screens. Check them on the deployed app.

## 6. Out of Scope

- A new logo design.
