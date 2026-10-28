---
type: decision
id: '0009'
status: accepted
date: 2026-10-22
modules:
  - '[[settings-lookups]]'
tags: [decision]
---

# 0009 Lookup tables share one generic Settings implementation

## Context

The report, event and user forms draw on several small lookup tables. A separate CRUD page for each would repeat the same table, form and actions.

## Decision

They go through the `LOOKUPS` map in `src/app/(admin)/settings/_components/settings-page.tsx`, `LookupTable` and the generic actions in `src/actions/settings`. They show as tabs on one Settings page (`54623a8`, 2026-10-12). Today the tabs are clusters, units, buildings, positions, casualty conditions and damage conditions, plus a separate Population fields tab. A new lookup table is a new `LOOKUPS` entry, not a new page.

User types and event statuses are seeded tables (`npm run seed`) with no Settings tab. `CLAUDE.md` still lists them as tabs.

## Consequences

- Lookup behaviour (scoping, active flag, ordering) lives in one place.
- A table that needs more than that, like the checklist, gets its own page.

## Links

- [[settings-lookups]]
