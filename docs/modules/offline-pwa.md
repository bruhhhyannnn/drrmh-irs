---
type: module
module: offline-pwa
paths:
  - src/lib/offline-queue.ts
  - src/lib/offline-flush.ts
  - src/lib/offline-cache.ts
  - src/components/pwa
  - src/store/offline-queue.store.ts
  - src/app/~offline
  - next.config.ts
  - public/manifest.json
tags: [module]
---

# Offline and PWA

The app installs as a PWA and keeps working on a weak or missing connection. New field reports, bystander reports and building assessments submitted offline are saved in IndexedDB on the device and sent again when the connection returns. ERT Members and bystanders rely on it most; the admin Add report drawer uses the same field report queue.

**Related:** [[architecture]] · [[field-reports]] · [[bystander-reports]] · [[assessments]] · [[data-layer]] · [[design-system]]

## Where it lives

| Path                                            | What it holds                                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next.config.ts`                                | `withPWA(...)` from `@ducanh2912/next-pwa`: service worker to `public/`, disabled in development, `fallbacks.document: '/~offline'`, the `ert-pages` runtime cache rule, `serverActions.bodySizeLimit: '8mb'` |
| `public/manifest.json`                          | PWA manifest (name, `display: standalone`, 192 and 512 icons). Linked from `src/app/layout.tsx` metadata                                                                                                      |
| `src/lib/offline-queue.ts`                      | IndexedDB database `irs-offline-queue` (version 3), the three queues, the draft and cache stores, `isNetworkError`, `getAllQueuedCount`                                                                       |
| `src/lib/offline-flush.ts`                      | `flushOne`: replays one queue (pure, tested in `offline-flush.test.ts`)                                                                                                                                       |
| `src/lib/offline-cache.ts`                      | `withTimeout`, `cachedFetch`: read through the local cache when offline or slow (tested in `offline-cache.test.ts`)                                                                                           |
| `src/components/pwa/offline-queue-provider.tsx` | `OfflineQueueProvider`: tracks connectivity, keeps the count, flushes all queues                                                                                                                              |
| `src/components/pwa/install-prompt.tsx`         | `InstallPrompt`: the install card (native `beforeinstallprompt`, or Add to Home Screen steps on iOS)                                                                                                          |
| `src/components/providers.tsx`                  | Mounts `InstallPrompt` and `OfflineQueueProvider` inside `AuthProvider`                                                                                                                                       |
| `src/store/offline-queue.store.ts`              | `useOfflineQueueStore` (Zustand)                                                                                                                                                                              |
| `src/app/~offline/page.tsx`                     | Fallback page shown by the service worker for an uncached page                                                                                                                                                |

## Data

No Prisma models of its own. It holds client-side copies of what later becomes `Report` (`reports`), `bystander_reports` and `Assessment` (`assessments`).

IndexedDB stores (`STORES` in `offline-queue.ts`):

- `reports` (key `id`): queued field reports, payload `ReportFormData & { user_id? }`.
- `bystander-reports` (key `id`): queued bystander reports, with photo `Blob`s in `attachments`.
- `assessments` (key `id`): queued assessments, payload `AssessmentPayload`.
- `assessment-drafts` (key `client_ref`): assessment drafts in progress.
- `assessment-cache` (key `key`): `{ key, value, savedAt }`, e.g. `template:published`, `template:<version_id>`.

A queued entry is `QueuedEntry<TPayload>`: `id`, `createdAt`, `payload`, optional `attachments`, optional `summary` (`title`, `subtitle` for "waiting to send" lists), `status` (`pending` | `failed`), `errorMessage`.

`Assessment.client_ref` is unique in the schema, so a replayed assessment that already landed is not inserted twice.

## Server actions

None of its own. The provider replays through other modules' actions:

- `createReport(payload)` in `src/actions/reports` (field reports).
- `createBystanderReport(payload, toBystanderPhotoFormData(photos))` in `src/actions/emergency-reports`.
- `createAssessment(await getAccessToken(), payload)` in `src/actions/assessments`. It answers `{ ok, error, retry }` instead of throwing; `submitQueuedAssessment` turns `retry: true` into a `TypeError` so the entry stays pending, and any other refusal into a normal `Error` so it is marked failed. Each send is capped at 30 s by `withTimeout`.

## Client side

- `OfflineQueueProvider` flushes on mount when `navigator.onLine`, on the `online` event, and every 45 s (`RETRY_INTERVAL_MS`) while online. It sets `flushNow` in the store for "Try sending now" buttons.
- After a flush it invalidates query keys: `bystander-reports`; `reports`, `my-report`, `my-latest-report` (field); `my-assessments`, `assessment-setup` (assessments). It shows toasts for sent and failed counts.
- `useOfflineQueueStore`: `isOnline`, `pendingCount`, `isSyncing`, `lastAttemptAt`, `lastFieldSyncAt`, `flushNow`, setters. It starts with `isOnline: true`; the provider corrects it on mount.
- Callers that queue: `ErtReportForm` (`src/app/(ert)/report/_components/report-form.tsx`), `ReportDrawer` (`src/app/(admin)/reports/_components/report-drawer.tsx`), the bystander form (`src/app/(public)/bystander-report/bystander-report-form.tsx`), and `useSubmitAssessment` in `use-assessments.ts`.
- `use-assessments.ts` reads the checklist and form setup through `cachedFetch` (`SLOW_NETWORK_MS` 6 s) and gives a submit 20 s (`SUBMIT_TIMEOUT_MS`) before queueing it.
- ERT UI: `WaitingToSend` chip (`src/app/(ert)/_components/waiting-to-send.tsx`) and `useFieldQueue` (`src/app/(ert)/_lib/use-field-queue.ts`). The assessment hub retries a failed entry with `retryQueuedAssessment` then `flushNow()`.
- `InstallPrompt` hides for 14 days after dismissal (`localStorage` key `irs-install-prompt-dismissed-at`) and never shows in standalone mode.

## Rules and gotchas

- Queue only on no connection (`!navigator.onLine`) or a network-shaped error (`isNetworkError`: `TypeError`, or a message matching fetch/network/connection). Any other error is a real rejection and is shown to the user, not queued.
- `flushOne` stops at the first network error (the rest stay queued) and continues past a server rejection, which it marks `failed`. Failed entries are never auto-retried and are not counted by `count()`.
- Only the assessment queue has a way back from `failed` (`retryQueuedAssessment` = `markPending`). Field and bystander queues export no retry.
- Queued assessments only send for the signed-in account: the `shouldSend` filter compares `payload.evaluator_id` with `useAuthStore` profile id, so a shared phone keeps another member's entries waiting.
- The pending count everywhere is `getAllQueuedCount()` (all three queues). `ReportDrawer` sets it from bystander + field counts only, so it leaves assessments out until the provider refreshes it.
- Each queue replays one create payload. Keep new-report data bundled in that payload (casualties, missing persons, population counts nested in `createReport`).
- Editing an existing report is online-only; only creates are queued.
- New stores go in `STORES`; `onupgradeneeded` only creates missing stores, so raise `DB_VERSION` when adding one. `onversionchange` closes the old connection so another tab can upgrade.
- IndexedDB missing (private mode, old browser): `getAll`/`count` return empty and the queue is a no-op.
- `reloadOnOnline: false` on purpose: a reload would lose an in-progress form. The provider handles syncing.
- `/assessment` and `/home` navigations use the `ert-pages` cache (`NetworkFirst`, 5 s timeout, `ignoreSearch: true`, 30 days), so `?draft=` and `?view=` URLs open offline.
- The service worker is off in `npm run dev`; test offline behaviour on a production build.
- Generated files (`public/sw.js`, `workbox-*.js`, `swe-worker-*.js`, `fallback-*.js`) are gitignored.
- The 8 MB server action body limit exists for bystander photos (up to 3, about 1 MB each after resizing).

## Decisions

- [[0003-webpack-build-for-pwa]]: `next-pwa` needs `next build --webpack`.
- [[0004-offline-queue-bundled-create]]: each queue replays one bundled create payload.
- [[0005-assessment-single-route]]: one `/assessment` route with query params so the service worker can cache it.
- [[0007-token-verified-actions]]: queued assessments are sent with the current access token and re-checked on the server.
