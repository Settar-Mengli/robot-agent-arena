# PROGRESS

## Status Snapshot
- Date: 2026-09-19
- Branch: `fix/duplicate-state-suites` (PR #30); base `main`
- Current state: **PR #30 ready to merge.** D-035 suites + D-036 pinning + pinned gemini ablation published (D-034). Keyless `eval:replay --suite all` at zero `fixture_miss`.
- Next: **A3** (see ROADMAP).
- Verification: typecheck / lint / coverage / SNAPSHOT_DRIFT drift-guards / `eval:replay --suite all` (zero absent)

## Completed
- Repository baseline and governance files exist.
- Legal, safety, naming, architecture, MVP scope, and non-goal constraints are recorded.
- Engine / inference / agent / eval spine through M-BENCH (see prior commits).
- **A1 hardening** (PR #27); **A2 code** (`grounded-v2` / `agent-v4-grounded`).
- **D-035** distinct-state snapshot suites; **D-036** pinning enforcement.
- **A2 result:** pinned gemini ablation on post-D-035 adversarial suites (see EVAL.md / D-034 amends).

## Open
- A3 and later roadmap items.
- Multi-model bench proof (`singleModelPending` still true).
- Memory variants unmeasured.
