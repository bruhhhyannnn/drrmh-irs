---
type: decision
id: '0004'
status: accepted
date: 2026-10-22
modules:
  - '[[offline-pwa]]'
  - '[[field-reports]]'
  - '[[bystander-reports]]'
  - '[[assessments]]'
tags: [decision]
---

# 0004 Offline submits replay one bundled create payload

## Context

ERT members and bystanders report from places with weak or no signal. A report used to be saved with several calls (the report, then casualties, missing persons and counts), so a dropped connection could leave half a report saved ([[plan/fix/DRRM-003-report-form-atomicity]]).

## Decision

A new report or assessment is one server call with everything nested: `createReport`, `createBystanderReport` and `createAssessment` each take the full payload. When the phone is offline, or the call fails the way a network failure does (`isNetworkError`), the payload goes into an IndexedDB queue (`src/lib/offline-queue.ts`). `OfflineQueueProvider` replays it whole on the `online` event, on mount and every 45 s. A network error stops the flush and leaves entries queued. If the server rejects an entry, it is marked `failed` and never retried automatically.

## Consequences

- Reports are never half saved, and a replay is a single call.
- Data for a new report must stay in that one call. Don't split a create into follow-up calls.
- Editing an existing report only works online.

## Links

- [[offline-pwa]] · first queues: `74ace1c`, `53c870f` (2026-09-09)
