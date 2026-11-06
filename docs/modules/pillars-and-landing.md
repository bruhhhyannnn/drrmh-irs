---
type: module
updated: 2026-11-06
module: pillars-and-landing
paths:
  - src/app/(pillars)
  - src/app/(public)/page.tsx
  - src/app/(public)/layout.tsx
  - src/app/(public)/_components
  - src/lib/campus-logo.ts
  - src/lib/pillar-trends.ts
tags: [module]
---

# DRRM pillar pages and public landing page

The public landing page at `/` introduces the system to anyone and links to the bystander report form and sign-in. The DRRM pillar pages show each pillar's building assessment results, Campus beside Off-campus: `/pillars` is an overview and `/pillars/<slug>` a pillar's detail. Administrators and Super Admins open them in a new tab from the admin sidebar. `src/lib/campus-logo.ts` maps a campus name to its logo file and is used by several modules.

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
| `src/app/(pillars)/pillars/page.tsx`                   | `PillarsPage`: the four pillars, Campus beside Off-campus (`PillarOverview`)                                                                                                                                                                              |
| `src/app/(pillars)/pillars/[pillar]/page.tsx`          | `PillarPage`: one per pillar, statically generated, with `PillarMetricsSection` reading its data on the client                                                                                                                                            |
| `src/app/(pillars)/pillars/[pillar]/_components/`      | Redesigned pillar page components (DRRM-027): `shared`, `score-tiles`, `fix-first`, `buildings-to-visit`, `places-table`, `pillar-charts`, `scored-view`, `recovery-view`                                                                                 |
| `src/app/(pillars)/pillars/_components/`               | `PillarsFrame` (header and width), `PillarOverview`, `ScopeNote`                                                                                                                                                                                          |
| `src/actions/pillars/index.ts`                         | `getPillarMetrics`, `getPillarOverview`                                                                                                                                                                                                                   |
| `src/lib/pillar-metrics.ts`                            | Pure metrics: `naRate`, `mostNa`, `lowestBuildings`, `pillarGroup`, `recoveryGroup`                                                                                                                                                                       |
| `src/lib/pillar-trends.ts`                             | Pure trends and charts arithmetic: `scoreBands`, `changeCounts`, `quarterlyTrend`, `monthlyActivity`, `overdueBuildings`, `failingBuildings`, `pillarTrends` (DRRM-027)                                                                                   |
| `src/components/hooks/use-pillars.ts`                  | `usePillarMetrics`, `usePillarOverview`                                                                                                                                                                                                                   |
| `src/lib/pillars.ts`                                   | `PILLARS` and `pillarHref(slug)` (shared with [[building-safety]] and [[checklist-editor]])                                                                                                                                                               |
| `src/lib/campus-logo.ts`                               | `campusLogo(name)`, `ownCampusLogo(name)`                                                                                                                                                                                                                 |
| `public/`                                              | Logos (`up-<campus>-logo.png`, `up-logo.png`, `irs-logo.png`, `upm-drrmh-logo.png`, `upri-logo.png`, `noah-logo.png`) and hero photos `upm-drrmh-background-1..4.jpg`                                                                                     |

## Data

The landing page has no server actions and no queries. The "Event summary" preview is a static mock from `SAMPLE_SUMMARY`, labelled "sample data" on the page.

The pillar pages read `Building`, `Assessment`, `AssessmentPillarScore` and `AssessmentAnswerRow` through `loadBuildingScores` and `loadRollupFacts`. Incident reports and drills are left out: a report must have a cluster, so that data would only cover campuses.

`PILLARS` slugs (`prevention-mitigation`, `preparedness`, `response`, `rehabilitation-recovery`) match `DrrmPillar.code` (`drrm_pillars`), per the comment on that model in `prisma/schema.prisma`.

## Server actions

`src/actions/pillars/index.ts`. Both take the access token and call `requireAdmin`, so an Administrator sees their own campus and the off-campus buildings its ERT members assessed:

- `getPillarMetrics(token, slug, campusId)`: `kind: 'scored'` with `ScoredView` per category (score, change, N/A rate, places, lowest buildings with dates and follow-up flags, sections, most-failed items with failing buildings drill-down, most-often N/A items, score bands, better/same/worse changes, quarterly trend, monthly activity, overdue and not-yet-assessed counts), or `kind: 'recovery'` with `RecoveryView`. `null` for a non-admin or unknown slug.
- `getPillarOverview(token, campusId)`: each pillar's tallies per category, and how many buildings were assessed.

## Client side

- `/`: the landing page. Section anchors `#who-its-for`, `#how-it-works`, `#privacy`, `#hotlines` (from `NAV_LINKS`). The root sets `data-smooth-scroll`, which turns on smooth scrolling in `globals.css` unless reduced motion is set.
- Calls to action: `ROUTES.report` = `/bystander-report` (bystanders), `ROUTES.signIn` = `/signin` (ERT Members and admins), `tel:` hotline links, and `mailto:` the contact email.
- `SmartLink` renders a Next.js `Link` for in-app paths and a plain `<a>` for `tel:`, `mailto:` and `#` links.
- Hero photos cross-fade with the `--animate-hero-fade` animation (16 s loop) defined in `globals.css`.
- The hero heading's campus takes turns through `HERO_CAMPUSES` (UP Manila, PGH, UP Diliman, UP System) with `--animate-campus-turn` (12 s loop, 3 s each). The names are `aria-hidden`; the `h1`'s `aria-label` reads all four. With reduced motion only UP Manila shows (DRRM-021).
- The partners bar has two groups: "Developed under the DRRM-H Program" with UP Manila and DRRM-H Center, then, after a divider shown on `lg` only, the UP Resilience Institute and the NOAH wordmark. NOAH sits on a `data-theme="light"` chip so its black letters read on the dark theme.
- `/pillars`: the overview table, linking to each pillar.
- `/pillars/<slug>`: redesigned (DRRM-027). A single category at a time (`Campus · N buildings | Off-campus · N` switch in `?view=`), with a Super-Admin campus picker updating `useCampusScopeStore` (administrators see their own campus text). In decision order:
  1. **How are we doing:** pooled score tile with change pts, buildings assessed, need follow-up, answered N/A rate.
  2. **What to fix first:** full-width most-failed checklist items with bars, expandable to list failing buildings.
  3. **Buildings to visit:** lowest-scoring buildings with follow-up tag, score bar, and assessment date.
  4. **Where it's weakest:** table of places with assessed count, score and change.
  5. **Trends and activity:** quarterly score trend (Chart A, Campus vs Off-campus in `LineChart`), score bands (Chart B in `BandBars` with interactive drill-down and no-score note), better/same/worse (Chart C in `ChangeBar` with drill-down), and monthly activity & overdue (Chart E in `ActivityBars`).
  6. **Folded sections:** 5. By checklist section (Chart D, section score bars lowest first) and Does the checklist fit? (questions most often answered N/A).
  - **Rehabilitation & Recovery:** dedicated view showing continuity plan status tiles (in place, missing, N/A), buildings lacking a plan, places, quarterly adoption trend, plan change (`lost a plan`, `kept a plan`, `gained a plan`), and activity & overdue.
- The admin sidebar builds the pillar items from `PILLARS` in `src/app/(admin)/_components/shell/nav.ts` with `newTab: true` and the group label "DRRM pillars"; `admin-shell.tsx` adds `target="_blank"`.
- Campus logos: `ownCampusLogo` returns `/up-<slug>-logo.png` when the campus is in `CAMPUS_LOGOS` (baguio, cebu, diliman, losbanos, manila, mindanao, openuniversity, tacloban, visayas), else `null`. `campusLogo` falls back to `/up-logo.png`. Used by the print `Letterhead`, the admin `CampusMark` (shows initials when `null`), and the bystander form's campus step.

## Rules and gotchas

- The landing page and pillar page are server components; the `(pillars)` layout is a client component because of `ProtectedRoute`.
- `ProtectedRoute` sends ERT Members and Bystanders to `/home`, so pillar pages are admin-only in practice.
- `dynamicParams = false` plus `generateStaticParams` from `PILLARS`: an unknown slug is a 404, and a new pillar only needs an entry in `PILLARS`.
- If a pillar later becomes its own app, change `pillarHref` in `src/lib/pillars.ts`; the sidebar and the pillar nav both use it.
- A score leaves N/A answers out, so always show the N/A rate and building count beside a pillar score. Recovery has one item and reads as counts, not a percent.
- `PILLARS` order matters: building safety and the assessment score views filter out `rehabilitation-recovery` (not scored) and look pillars up by slug.
- `campusSlug` strips accents, a leading "UP " and every non-letter ("UP Los Baños" becomes `losbanos`). A new campus logo needs the file in `public/` and the slug added to `CAMPUS_LOGOS`.
- Landing copy lives in `content.ts`; change text there, not inside the section components.
- The landing page uses the design-system fonts (Figtree, Spline Sans Mono) through `font-landing`, and theme tokens (`bg-surface`, `text-gray-900`), so it follows light and dark mode.
- `Providers` in the root layout renders nothing until mounted on the client, so the landing content appears only after hydration.

## Decisions

- [[0010-off-campus-buildings]] off-campus results stay apart from campus scores.
- [[0007-token-verified-actions]] pillar reads verify the token with `requireAdmin`.
