---
type: decision
id: '0010'
status: accepted
date: 2026-11-05
modules:
  - '[[assessments]]'
  - '[[assessment-admin]]'
  - '[[building-safety]]'
  - '[[pillars-and-landing]]'
  - '[[database]]'
tags: [decision]
---

# 0010 A building is either Campus or Off-campus

## Context

The system is being pilot-tested outside UP campuses, starting with the ERT Assessment tool and using existing UP accounts. Every building had to belong to a unit, and admin access, lists, the dashboard and the printout all followed Building → Unit → Cluster → Campus. A building at a pilot site has no unit. Assessments also have to work offline, and the Report tool's map address needs internet and doesn't split into official location levels.

## Decision

A building has one of two shapes, enforced by `chk_buildings_place`:

- **Campus:** has a unit, as before. Existing buildings are all this shape and didn't change.
- **Off-campus:** no unit. It has `campus_id` (the evaluator's campus) and a PSGC location. Having no unit is what makes it off-campus, because campus buildings are in barangays too.

The location dropdowns use the PSGC list in `src/data/psgc.json`, which the phone keeps in `assessment-cache`. The map pin is optional and doesn't fill in the dropdowns. The phone sends only `barangay_code`; the server derives the other levels and names from its own copy and stores them on the building.

The owning campus decides who may see a building. It never adds to that campus's score: `campusBuildings` in `src/lib/building-place.ts` is the only filter campus scores read through. The dashboard and pillar pages show Off-campus separately, by location.

## Consequences

- Campus numbers and pages don't change when off-campus buildings are added.
- Queued assessments and drafts from before this change still submit as campus (`locationKindOf`).
- `unit` and `cluster` can be null on a building, so reads go through `toBuildingPlace`.
- Two campuses assessing the same site create two buildings.
- Off-campus buildings aren't listed or editable in Settings, and incident reports remain campus-only.
- The list comes from the psgc.gitlab.io mirror because the PSA's site blocks automated downloads. It predates the 2024 Negros Island Region, so those provinces sit under Regions VI and VII until the list is rebuilt from a newer source (`npm run psgc:build`, then bump `PSGC_VERSION`).

## Links

- Plan: [[plan/feature/DRRM-024-off-campus-assessment]]
- Commit / PR:
