---
type: decision
id: '0005'
status: accepted
date: 2026-10-22
modules:
  - '[[assessments]]'
  - '[[offline-pwa]]'
tags: [decision]
---

# 0005 The assessment is one route with query params

## Context

An ERT member may start, continue or open an assessment with no signal. The service worker caches pages by URL, so a dynamic segment like `/assessment/[id]` might not be cached for an id the phone hasn't opened before.

## Decision

Everything lives on `/assessment`: the hub with no params, `?draft=<client_ref>` for the stepper, `?view=<id>` for the read-only view, and `?print=<id>` for the A4 page. The print view renders without `ErtFrame` but keeps the ERT guard.

## Consequences

- One cached page works offline for every draft.
- The page picks its view from the params instead of from the file tree, so keep that switch easy to read.
- The admin pages follow the same pattern with `?id=` (`/assessments/details?id=`, `/assessments/report?id=`).

## Links

- [[plan/feature/DRRM-015-assessment-form]] (routes section)
