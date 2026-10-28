---
type: decision
id: '0008'
status: accepted
date: 2026-10-22
modules:
  - '[[building-safety]]'
  - '[[dashboard]]'
  - '[[design-system]]'
tags: [decision]
---

# 0008 Charts are hand-built, with no chart library

## Context

The old dashboard used pie charts you had to hover over to read ([[plan/feature/DRRM-011-super-admin-v2]]). Charts also have to follow the light and dark tokens and print on A4.

## Decision

Charts are small components in `src/app/(admin)/_components/charts/`, coloured with the `--series-1…6` tokens from `globals.css` (checked with the dataviz validator). Values are always printed on the chart, never shown only on hover. No chart library is installed; the unused ones were removed in the knip cleanup (`177180e`).

## Consequences

- Charts read the same on a phone, on paper and in both themes.
- Each new chart type is built by hand, so reuse the existing components first.

## Links

- [[building-safety]] · [[plan/review/2026-10-12-knip-unused-code]] · `15bf94b` (2026-10-21)
