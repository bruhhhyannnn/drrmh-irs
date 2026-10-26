---
type: module
module: design-system
paths:
  - src/components/ds
  - src/components/ui
  - src/components/common
  - src/components/theme
  - src/lib/theme.ts
  - src/store/theme.store.ts
  - src/app/globals.css
  - src/app/(admin)/_components
tags: [module]
---

# Design system and theming

Shared UI building blocks, colour tokens and light / dark mode. Every page uses it: the public landing and bystander form, sign-in, the ERT pages and the admin dashboard. The theme choice (Light, Dark, Device) is set per device in My profile by any signed-in user.

**Related:** [[architecture]] · [[conventions]] · [[pillars-and-landing]] · [[print]] · [[building-safety]] · [[campus-scoping]] · [[settings-lookups]]

## Where it lives

| Path                                                    | What it holds                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ds/`                                    | Design-system controls: `Button`, `ButtonLink`, `TextInput`, `PasswordInput`, `TextArea`, `SelectField`, `OptionTile`, `SegmentedControl`, `Stepper`, `FieldLabel`, `FieldHelp`, `FieldError` (`fields.tsx`); `Drawer`; `Banner`; `Switch`, `SwitchField`; `LocationPicker`; `PeopleDrawer` and people helpers (`people.ts`); `PrivacyDrawer`; `FOCUS_RING`; `figtree`, `splineSansMono` |
| `src/components/ui/`                                    | Older generic pieces: `Loader`, `Skeleton`, `Spinner`, `Modal`, `Button`, and the vendored `map.tsx` (`Map`, `MapControls`, `MapMarker`, `MarkerContent`, `useMap`)                                                                                                                                                                                                                      |
| `src/components/common/`                                | `DataPrivacyContent` and the privacy notice constants; `MapFlyTo`, `MapClickHandler` (`map-pick.tsx`)                                                                                                                                                                                                                                                                                    |
| `src/components/theme/`                                 | `ThemeSync` (mounted in `Providers`), `AppearanceSetting` (shown in `src/components/auth/profile-drawer.tsx`)                                                                                                                                                                                                                                                                            |
| `src/lib/theme.ts`                                      | `ThemePreference`, `THEME_STORAGE_KEY` (`irs-theme`), `readThemePreference`, `applyTheme`, `watchSystemTheme`, `THEME_SCRIPT`                                                                                                                                                                                                                                                            |
| `src/store/theme.store.ts`                              | `useThemeStore` (Zustand): `preference`, `setPreference`                                                                                                                                                                                                                                                                                                                                 |
| `src/app/globals.css`                                   | Tailwind v4 `@theme` tokens, light and dark values, custom variants                                                                                                                                                                                                                                                                                                                      |
| `src/app/(admin)/_components/shell/`                    | `AdminShell`, `CampusSwitcher`, `useScopedCampusId`, `useIsSuperAdmin`, `nav.ts` (`navFor`, `SUPER_ADMIN_HREFS`, `isActivePath`)                                                                                                                                                                                                                                                         |
| `src/app/(admin)/_components/data-list.tsx`             | List pattern: `ListCard`, `ListTabs`, `ListToolbar`, `SearchField`, `FilterSelect`, `ListCount`, `DataTable`, `TableHead`, `TableCell`, `TableSkeleton`, `NameCell`, `TextCell`, `NumberCell`, `IconAction`, `RowActions`, `RowButton`, `MobileCard`, `Pager`                                                                                                                            |
| `src/app/(admin)/_components/drawer-parts.tsx`          | `DrawerBody`, `DrawerSection`, `FormGrid`, `FormField`, `KvList`, `DrawerButtons`, `DrawerButton`, `PersonHeader`, `StatBoxes`                                                                                                                                                                                                                                                           |
| `src/app/(admin)/_components/confirm-dialog.tsx`        | `ConfirmDialog`, `CheckBox`                                                                                                                                                                                                                                                                                                                                                              |
| `src/app/(admin)/_components/ui.tsx`, `page-header.tsx` | `Card`, `Chip`, `Mono`, `Avatar`, `CampusMark`, `Bar`, `EmptyNote`, `CardHeading`, `DateBlock`; `PageHeader`                                                                                                                                                                                                                                                                             |
| `src/app/(admin)/_lib/`                                 | `format.ts` (dates, `personName`, `plural`), `status.ts` (`Tone`, `eventTone`, `bystanderTone`, `userTypeTone`)                                                                                                                                                                                                                                                                          |

## Data

No Prisma models. Client state only: the theme preference in `localStorage` (`irs-theme`; absent means `system`).

## Server actions

None.

## Client side

- Theme flow: `THEME_SCRIPT` runs in `<head>` of `src/app/layout.tsx` and sets the `dark` class on `<html>` before first paint. `ThemeSync` keeps it in step with `useThemeStore`, with the device setting under `system`, and with other tabs (the `storage` event). `AppearanceSetting` is the Light / Dark / Device switch.
- Fonts: `figtree` (body) and `splineSansMono` (numbers) from `next/font/google`. Page roots add their `.variable` classes and use `font-landing` / `font-landing-mono`. The base `font-sans` is Inter, set in the root layout.
- `AdminShell`: sidebar from 1024 px, an 88 px icon rail from 768 px, bottom tabs on phone. `CampusScopeGate` sends non-Super-Admins away from `SUPER_ADMIN_HREFS` (`/campus`, `/assessments/checklist`) and shows "No campus assigned" when an Administrator has no `campus_id`.
- `DataTable` is a grid table on tablet and web and a `MobileCard` per row on phone. Columns with `hideOnTablet` show from 1024 px. `Pager` shows nothing for one page.
- `Drawer` is a side drawer from 768 px and a bottom sheet on phones. Children mount fresh on each open. `size="wide"` is the admin drawer.
- `SelectField` and `FilterSelect` are native `<select>` elements, chosen for phones.
- Custom variants in `globals.css`: `dark` (skips any `[data-theme='light']` subtree), `print-report` (inside `[data-print-report]`), `large-text` (inside `[data-large-text]`, set by `ErtFrame` and the bystander report page).

## Rules and gotchas

- Use theme tokens, not raw colours: `bg-canvas` for page backgrounds, `bg-surface` (not `bg-white`) for cards, bars, drawers and inputs, `border-line` for hairlines, `bg-brand-solid` for maroon fills with white text. `brand-500` is the accent for text, icons and borders and turns light in dark mode.
- Gray, brand and status tint classes need no `dark:` variant: `globals.css` maps them to CSS variables that change under `.dark`. `gray-900` is always the strongest text.
- Solid status colours (`success-500/600`, `error-500/600`, `warning-500/600`, `info-500`) and hex values in class names are the same in both themes.
- `data-theme="light"` keeps a subtree light (the A4 reports through `PrintShell`).
- Chart series colours are `--series-1` to `--series-6`, with separate light and dark values. Print the values next to the marks; slots 3 to 5 are under 3:1 contrast on white.
- `--text-xs` to `--text-3xl` are redefined (14 px to 32 px), so Tailwind's `text-sm` is 16 px here, not 14 px. Most redesigned pages use explicit `text-[15px]` sizes.
- `FOCUS_RING` is the keyboard focus style for every interactive element in the redesigned pages. Add it to new buttons and links.
- Two `Button`s exist. New code uses the ds pill `Button` from `@/components/ds`; `src/components/ui/button.tsx` is not imported outside `src/components/ui`.
- `install-prompt.tsx` imports from `@/components/ds/fields` directly, because the ds barrel also pulls in the map. Do the same in code that mounts on every page.
- `src/components/ui/map.tsx` is vendored from mapcn, has `@ts-nocheck`, and is in the ESLint `ignores`. Do not fix lint there.
- `Providers` returns `null` until mounted, and wraps everything in `QueryClientProvider`, `ThemeSync` and `AuthProvider`.
- Prettier sorts Tailwind classes and imports; do not order them by hand.
- Admin chart components live in `(admin)/_components/charts/` and `summary/`; see [[building-safety]] and [[events]].

## Decisions

- [[0008-hand-built-charts]]: charts are built by hand with the `--series-*` tokens, no chart library.
- [[0009-table-driven-settings]]: the Settings tabs reuse the shared list and drawer parts through `LookupTable`.
