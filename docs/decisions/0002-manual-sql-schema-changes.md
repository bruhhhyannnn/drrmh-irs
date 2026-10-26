---
type: decision
id: '0002'
status: accepted
date: 2026-10-22
modules:
  - '[[database]]'
tags: [decision]
---

# 0002 Schema changes ship as idempotent manual SQL

## Context

Several worktrees share Supabase projects, and production is changed by hand in the Supabase SQL editor. `prisma db push`, `migrate dev` and `migrate reset` can drop data or rewrite a shared database without warning.

## Decision

Each schema change is an idempotent SQL file in `prisma/manual/<ticket>.sql` (for example `DRRM-015-assessment.sql`), plus the matching edit to `prisma/schema.prisma`. It is applied with `prisma db execute --file` over the direct connection (`DIRECT_URL`), because the pooler on :6543 hangs on `db execute`. `db push`, `migrate dev` and `migrate reset` are forbidden. The ban went into `CLAUDE.md` on 2026-09-08 (`6912f90`).

## Consequences

- A file is safe to run twice, and the same file goes to production.
- `schema.prisma` and the SQL can drift apart if someone edits only one of them, so review both in the same PR.
- New changes don't go in `prisma/migrations/`.

## Links

- [[conventions]] (exact command) · first manual file: `prisma/manual/DRRM-008-bystander-report-v2.sql` (`431062a`, 2026-10-11)
