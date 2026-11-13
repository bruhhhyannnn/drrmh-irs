---
type: decision
id: '0011'
status: accepted
date: 2026-11-12
modules:
  - '[[assessments]]'
  - '[[database]]'
tags: [decision]
---

# 0011 The structural integrity tool is fixed data in code

## Context

DRRM-044 adds the Rapid Condition Assessment Tool (RCAsT), Material Component, to the building assessment. The MATATAG checklist is a versioned template in the database that the Super Admin can edit ([[0006-versioned-checklist-template]]), and every item there is Yes / No / N/A scored as safe or unsafe.

The structural tool doesn't fit that shape. A defect that is present needs two more grades (how bad, how widespread), the rating is a formula over exactly ten rows and four elements (its denominator, 72, is those ten rows at their worst), and a higher rating is worse.

## Decision

The tool's elements, defects, wording, choices and formula live in `src/lib/structural-integrity.ts`, not in the template tables. The answers are stored in their own tables (`assessment_structural_summaries`, `assessment_structural_findings`) with the edition they were answered with in `tool_version` (`STRUCTURAL_TOOL_VERSION`).

The form shows the tool as four steps after the checklist's sections, one per element. Its result is shown beside the MATATAG score and is never added to the pillar scores.

## Consequences

- The Super Admin can't edit the structural questions in the checklist editor. A change of wording is a code change.
- A change to the rows, the factors or the formula needs a new `STRUCTURAL_TOOL_VERSION`, so ratings from different editions aren't compared as if they were the same.
- The checklist editor, the template seed and the pillar rollups didn't have to change.
- The structural part isn't in the dashboard's Building safety numbers.

## Links

- Plan: [[plan/feature/DRRM-044-structural-integrity]]
