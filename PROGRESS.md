# PROGRESS

## Status Snapshot
- Date: 2026-09-19
- Branch: `feat/a3-env-interface` (A3); base `main` @ 95bb5d5
- Current state: **A3 complete on branch** — environment interface + robot adapter, eval rewire, differential proof (**13842** states / 0 diffs: apply≡engine, suite oracle≡committed, match-walk parallel greedy/runtime), docs.
- Next: **A-to-Z recon**, then execution batch **B** (UI scaffolding + Builder).
- Verification: typecheck / lint / coverage / SNAPSHOT_DRIFT drift-guards (incl. env differential) / `eval:replay --suite all` (zero absent)

## Completed
- Repository baseline and governance files exist.
- Legal, safety, naming, architecture, MVP scope, and non-goal constraints are recorded.
- Engine / inference / agent / eval spine through M-BENCH (see prior commits).
- **A1 hardening** (PR #27); **A2** (`grounded-v2` / pinned ablation).
- **D-035** distinct-state snapshot suites; **D-036** pinning enforcement.
- **A3** environment interface (`src/env`), adapter-only port, committed differential proof.

## Open
- A-to-Z recon; batch B and later roadmap items.
- Multi-model bench proof (`singleModelPending` still true).
- Memory variants unmeasured.
