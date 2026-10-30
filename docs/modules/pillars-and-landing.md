---
type: module
updated: 2026-10-29
module: pillars-and-landing
paths:
  - src/app/(pillars)
  - src/app/(public)/page.tsx
  - src/app/(public)/layout.tsx
  - src/app/(public)/_components
  - src/lib/campus-logo.ts
tags: [module]
---

# DRRM pillar pages and public landing page

Two groups of mostly static pages. The public landing page at `/` introduces the system to anyone and links to the bystander report form and sign-in. The four DRRM pillar pages at `/pillars/<slug>` are placeholders for future pillar apps; Administrators and Super Admins open them in a new tab from the admin sidebar. `src/lib/campus-logo.ts` maps a campus name to its logo file and is used by several modules.

**Related:** [[architecture]] · [[bystander-reports]] · [[auth]] · [[building-safety]] · [[design-system]] · [[print]]

## Where it lives

| Path                                                   | What it holds                                                                                                                                                                                                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/(public)/page.tsx`                            | `LandingPage`: Hero, PartnersBar, AudienceSection, SummaryPreview, HowItWorks, PrivacySection, QuoteSection, VisionMission, HotlinesSection, AccessCta, SiteFooter                                                                                        |
| `src/app/(public)/layout.tsx`                          | Pass-through layout, no auth                                                                                                                                                                                                                              |
| `src/app/(public)/_components/content.ts`              | All landing copy as constants: `ROUTES`, `CONTACT`, `NAV_LINKS`, `HERO_IMAGES`, `HERO_CAMPUSES`, `PARTNERS`, `PARTNER_INSTITUTES`, `AUDIENCES`, `SAMPLE_SUMMARY`, `STEPS`, `PRIVACY_POINTS`, `QUOTE`, `VISION`, `MISSION`, `NATIONAL_HOTLINE`, `HOTLINES` |
| `src/app/(public)/_components/primitives.tsx`          | Landing building blocks: `Section`, `Container`, `SectionHeading`, `Eyebrow`, `Lead`, `CheckItem`, `SmartLink`, `ButtonLink`, `TextLink`, `ArrowLink`, `TEXT_BUTTON`, `FOCUS_RING`                                                                        |
| `src/app/(public)/_components/privacy-notice-lead.tsx` | The only client component here: opens `DataPrivacyContent` in a `Modal`                                                                                                                                                                                   |
| `src/app/(public)/_components/index.ts`                | Barrel; also re-exports `figtree`, `splineSansMono` from `src/components/ds/fonts`                                                                                                                                                                        |
| `src/app/(pillars)/layout.tsx`                         | Wraps pillar pages in `ProtectedRoute`; no IRS shell                                                                                                                                                                                                      |
| `src/app/(pillars)/pillars/[pillar]/page.tsx`          | `PillarPage`: one placeholder per pillar, statically generated                                                                                                                                                                                            |
| `src/lib/pillars.ts`                                   | `PILLARS` and `pillarHref(slug)` (shared with [[building-safety]] and [[checklist-editor]])                                                                                                                                                               |
| `src/lib/campus-logo.ts`                               | `campusLogo(name)`, `ownCampusLogo(name)`                                                                                                                                                                                                                 |
| `public/`                                              | Logos (`up-<campus>-logo.png`, `up-logo.png`, `irs-logo.png`, `upm-drrmh-logo.png`, `upri-logo.png`, `noah-logo.png`) and hero photos `upm-drrmh-background-1..4.jpg`                                                                                     |

## Data

No database reads or writes. The landing page has no server actions and no queries. The "Event summary" preview is a static mock from `SAMPLE_SUMMARY`, labelled "sample data" on the page.

`PILLARS` slugs (`prevention-mitigation`, `preparedness`, `response`, `rehabilitation-recovery`) match `DrrmPillar.code` (`drrm_pillars`), per the comment on that model in `prisma/schema.prisma`. The pillar pages themselves do not read the table.

## Server actions

None.

## Client side

- `/`: the landing page. Section anchors `#who-its-for`, `#how-it-works`, `#privacy`, `#hotlines` (from `NAV_LINKS`). The root sets `data-smooth-scroll`, which turns on smooth scrolling in `globals.css` unless reduced motion is set.
- Calls to action: `ROUTES.report` = `/bystander-report` (bystanders), `ROUTES.signIn` = `/signin` (ERT Members and admins), `tel:` hotline links, and `mailto:` the contact email.
- `SmartLink` renders a Next.js `Link` for in-app paths and a plain `<a>` for `tel:`, `mailto:` and `#` links.
- Hero photos cross-fade with the `--animate-hero-fade` animation (16 s loop) defined in `globals.css`.
- The hero heading's campus takes turns through `HERO_CAMPUSES` (UP Manila, PGH, UP Diliman, UP System) with `--animate-campus-turn` (12 s loop, 3 s each). The names are `aria-hidden`; the `h1`'s `aria-label` reads all four. With reduced motion only UP Manila shows (DRRM-021).
- The partners bar has two groups: "Developed under the DRRM-H Program" with UP Manila and DRRM-H Center, then, after a divider shown on `lg` only, the UP Resilience Institute and the NOAH wordmark. NOAH sits on a `data-theme="light"` chip so its black letters read on the dark theme.
- `/pillars/<slug>`: header with "IRS dashboard" back button, "Pillar n of 4", name, summary, a "Coming soon" note, example activities from RA 10121, and a nav to the other three pillars.
- The admin sidebar builds the pillar items from `PILLARS` in `src/app/(admin)/_components/shell/nav.ts` with `newTab: true` and the group label "DRRM pillars"; `admin-shell.tsx` adds `target="_blank"`.
- Campus logos: `ownCampusLogo` returns `/up-<slug>-logo.png` when the campus is in `CAMPUS_LOGOS` (baguio, cebu, diliman, losbanos, manila, mindanao, openuniversity, tacloban, visayas), else `null`. `campusLogo` falls back to `/up-logo.png`. Used by the print `Letterhead`, the admin `CampusMark` (shows initials when `null`), and the bystander form's campus step.

## Rules and gotchas

- The landing page and pillar page are server components; the `(pillars)` layout is a client component because of `ProtectedRoute`.
- `ProtectedRoute` sends ERT Members and Bystanders to `/home`, so pillar pages are admin-only in practice.
- `dynamicParams = false` plus `generateStaticParams` from `PILLARS`: an unknown slug is a 404, and a new pillar only needs an entry in `PILLARS`.
- When the pillar apps exist, change `pillarHref` in `src/lib/pillars.ts`; the sidebar and the pillar nav both use it.
- `PILLARS` order matters: building safety and the assessment score views filter out `rehabilitation-recovery` (not scored) and look pillars up by slug.
- `campusSlug` strips accents, a leading "UP " and every non-letter ("UP Los Baños" becomes `losbanos`). A new campus logo needs the file in `public/` and the slug added to `CAMPUS_LOGOS`.
- Landing copy lives in `content.ts`; change text there, not inside the section components.
- The landing page uses the design-system fonts (Figtree, Spline Sans Mono) through `font-landing`, and theme tokens (`bg-surface`, `text-gray-900`), so it follows light and dark mode.
- `Providers` in the root layout renders nothing until mounted on the client, so the landing content appears only after hydration.

## Decisions

- None of the listed decisions apply directly. The pages use no database and no server actions.
