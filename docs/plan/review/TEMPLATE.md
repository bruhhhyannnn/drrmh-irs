# [REV-YYYY-MM-DD] Code Review & Audit: Short Title

- **Review Date:** YYYY-MM-DD
- **Target Branch / PR / Files:** `branch-name` or `PR #XX`
- **Reviewer:**
- **Status:** `[Draft | In Review | Completed | Action Items Created]`
- **Overall Recommendation:** `[Approve | Request Changes | Comment / Advisory Only]`

---

## 1. Executive Summary

Brief overview of the changes reviewed, their purpose, and the overall assessment of quality, risk, and readiness.

---

## 2. Evaluation Matrix

| Category                       | Assessment | Key Notes |
| :----------------------------- | :--------- | :-------- |
| **Architecture & Conventions** | `[Pass     | Warning   | Fail]` | Server Actions only, TanStack query hooks, Prisma models          |
| **Correctness & Edge Cases**   | `[Pass     | Warning   | Fail]` | Logic bugs, null safety, FK constraints, race conditions          |
| **Security & Authorization**   | `[Pass     | Warning   | Fail]` | Role gating, server action session validation, input sanitization |
| **Database & Performance**     | `[Pass     | Warning   | Fail]` | Query count, N+1 issues, in-memory filtering, indexing            |
| **State & Cache Invalidation** | `[Pass     | Warning   | Fail]` | Zustand persistence, TanStack query keys, `revalidatePath`        |
| **UI/UX & Accessibility**      | `[Pass     | Warning   | Fail]` | Forms (Zod), responsiveness, theme support (dark/light)           |

---

## 3. Detailed Findings

### 3.1 🚨 Critical / Blockers (Must Fix Before Merge)

Issues that cause crashes, data corruption, security vulnerabilities, or severe regressions.

- **Issue 1:** `Brief title`
  - **Location:** `src/...:line_range`
  - **Problem:** Explanation of the defect.
  - **Impact:** What happens if left unfixed.
  - **Suggested Fix:**
    ```ts
    // Code snippet showing the recommended resolution
    ```

---

### 3.2 ⚠️ High / Medium Priority (Optimizations & Edge Cases)

Performance bottlenecks, missing error handling, cache key mismatches, or multi-campus isolation gaps.

- **Issue 1:** `Brief title`
  - **Location:** `src/...:line_range`
  - **Problem:** ...
  - **Suggested Fix:** ...

---

### 3.3 💡 Low Priority / Optional Improvements & Cleanups

Code readability, minor refactors, naming consistency, typing improvements, or UI polish.

- **Note 1:** `Brief description` (`src/...:line_range`)

---

## 4. Action Checklist & Next Steps

- [ ] Create fix plans under `docs/plan/fix/` for critical items.
- [ ] Address required changes in the target branch.
- [ ] Run verification tests (`npm run lint`, `npm run type-check`, `npm run build`).
- [ ] Re-review and sign off.
