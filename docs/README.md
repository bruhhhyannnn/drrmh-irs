# Documentation Directory (`docs/`)

This directory contains engineering plans, architectural designs, code reviews, bug analyses, and feature specifications for the **UPM DRRM-H Incident Reporting System (IRS)**.

## Directory Structure

```text
docs/
└── plan/
    ├── review/     # Code reviews, audit findings, security & performance reviews
    ├── fix/        # Resolution & execution plans for bugs, audits, and refactors
    ├── bugs/       # Bug reports, root-cause analyses (RCA), and issue reproductions
    └── feature/    # Feature specifications, RFCs, and implementation task breakdowns
```

---

## Workflow & Lifecycle

Every non-trivial engineering task follows this lifecycle:

1. **Document the Need**:
   - For reviews: Save audit findings in `docs/plan/review/`.
   - For bugs: Create an entry in `docs/plan/bugs/` describing expected vs actual behavior and root cause.
   - For fixes/refactors: Write an execution plan in `docs/plan/fix/`.
   - For features: Write an RFC/spec in `docs/plan/feature/`.
2. **Plan the Execution**:
   - Write the step-by-step action plan with checklists.
   - Include test/verification steps and migration notes.
3. **Implement & Link**:
   - Reference the doc in commit messages / PR descriptions (e.g. `fix(events): resolve cluster mapping per docs/plan/fix/DRRM-003.md`).
4. **Update Status**:
   - Mark items as `[Draft]` → `[Approved]` → `[In Progress]` → `[Done]`.

---

## File Naming Conventions

Use lowercase kebab-case with ticket prefixes or ISO dates:

- `review/2026-09-08-dev-branch-audit.md`
- `bugs/DRRM-003-auth-profile-sync.md`
- `fix/DRRM-001-audit-resolution.md`
- `feature/DRRM-004-dynamic-campus-clusters.md`
