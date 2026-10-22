---
type: decision
id: '0003'
status: accepted
date: 2026-10-22
modules:
  - '[[offline-pwa]]'
tags: [decision]
---

# 0003 The production build uses webpack

## Context

The PWA plugin `@ducanh2912/next-pwa` hooks into the webpack build to generate the service worker. Next.js 16 builds with Turbopack by default, and Turbopack doesn't run that hook.

## Decision

`npm run build` is `next build --webpack` (`0018181`, 2026-09-09). The PWA is disabled in dev. Don't switch the build to Turbopack.

## Consequences

- Production builds generate the service worker and the `/~offline` fallback.
- Builds are slower than with Turbopack. Revisit only if next-pwa, or whatever replaces it, supports Turbopack.

## Links

- [[offline-pwa]] · `next.config.ts`
