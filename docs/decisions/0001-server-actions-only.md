---
type: decision
id: '0001'
status: accepted
date: 2026-10-22
modules:
  - '[[data-layer]]'
tags: [decision]
---

# 0001 Server actions are the only data path

## Context

The app needs Postgres reads and writes from many pages, for signed-in users and anonymous bystanders. The Supabase anon client could query tables straight from the browser. That would put the rules for who can read which rows in two places: Postgres RLS and the app code.

## Decision

Every read and write goes through a `'use server'` function in `src/actions/<domain>/index.ts`, using the Prisma client from `src/lib/prisma.ts`. Components never import Prisma. On the client, `src/components/hooks/use-<domain>.ts` wraps the actions in TanStack Query. Mutations call `revalidatePath(...)` on the server and invalidate query keys on the client. The browser Supabase client (`src/lib/supabase.ts`) is used for auth and Realtime only. The service-role client (`src/lib/supabase-admin.ts`) is used only for what Prisma can't do (the Auth admin API).

## Consequences

- Permissions and campus scope are checked in one place per domain.
- Server actions are public POST endpoints, so each one has to check its own caller. Newer actions do this with a token ([[0007-token-verified-actions]]).
- Server actions hide thrown messages in production, so newer actions return expected failures as values.

## Links

- [[architecture]] · [[conventions]]
