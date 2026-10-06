# Phase 2.9C Implementation Plan

Spec: `docs/superpowers/specs/2026-10-05-admin-order-workflow-design.md`

1. Add a focused admin-order API regression script first and observe failures
   for missing verification, payment gating, admin detail and richer search.
2. Implement backend admin detail/search, transactional bank verification and
   paid-before-confirmed rules; run the focused suite green.
3. Replace the generic admin order list with a paginated/filterable list and add
   the admin order detail/action page with confirmation modals.
4. Run focused admin tests, all existing backend regression suites, frontend
   build/lint, `git diff --check` and `git status --short`.
5. Perform one fresh code review of the complete Phase 2.9C diff, address any
   important findings with tests, and report remaining browser checks.

Ruling: work in the user's existing workspace without worktree or commits because
the user explicitly prohibited commits and asked to continue the current dirty
project state. Existing unrelated changes must be preserved.
