---
type: decision
id: '0006'
status: accepted
date: 2026-10-22
modules:
  - '[[checklist-editor]]'
  - '[[assessments]]'
  - '[[database]]'
tags: [decision]
---

# 0006 The MATATAG checklist is a versioned template in the database

## Context

The checklist will change: typo and translation fixes, new items, items moved to another DRRM pillar. Old assessments must still show and score against the questions they were answered with.

## Decision

The checklist is stored as `assessment_templates` → `assessment_template_versions` (`draft` | `published` | `retired`) → `assessment_sections` → `assessment_items`. A partial unique index allows one `published` version per template. Each assessment keeps the version it was answered with.

Wording fixes apply in place on any version, so old and new assessments both show the fixed text. Wording means an item's prompt, note or reference, or a section title. Structural changes need a `draft` version that is then published, which retires the previous published version. Structural means adding, removing, reordering or re-gating items, or changing an item's pillar.

The first version is seeded from `prisma/data/matatag-2025-07-25.ts` by `npm run seed:matatag`. The seed can be run again safely: it matches by code and never deletes.

## Consequences

- Structural edits never change what an old assessment was answered against.
- Comparisons between buildings or dates have to allow for assessments on different versions.
- Item ids stay the same when the seed is run again.

## Links

- [[checklist-editor]] · [[building-safety]] · editor: `b8235bf` (2026-10-21)
