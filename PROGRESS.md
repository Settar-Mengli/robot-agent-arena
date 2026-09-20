# PROGRESS

## Status Snapshot
- Date: 2026-09-20
- Branch: `feat/ui-foundation` (batch B foundation); base `main` @ 5807470
- Current state: **UI foundation complete on branch** — eslint `src/ui` fence, dual tsconfig, vitest node+ui projects, `PlayAgentTurnResult`, pure in-flight battle-view store + tests (D-038–D-041). No components / entry / Tailwind yet.
- Next: Builder + Arena UI (still batch B); fence root-level entry before app shell.
- Verification: typecheck (root + ui) / lint / vitest (node + ui) / `eval:replay --suite all` (types-only commit; zero fixture diffs)

## Completed
- Repository baseline and governance files exist.
- Legal, safety, naming, architecture, MVP scope, and non-goal constraints are recorded.
- Engine / inference / agent / eval spine through M-BENCH (see prior commits).
- **A1 hardening** (PR #27); **A2** (`grounded-v2` / pinned ablation).
- **D-035** distinct-state snapshot suites; **D-036** pinning enforcement.
- **A3** environment interface (`src/env`), adapter-only port, committed differential proof.
- **Batch B foundation** — UI layer fence, deps, tsconfig split, vitest projects, turn-result type, store contract.

## Open
- Batch B remainder: entry, styling, Builder, Arena (in-flight race already modeled in store).
- Root-level entry eslint coverage (carry-forward from D-038).
- A-to-Z recon; later roadmap items.
- Multi-model bench proof (`singleModelPending` still true).
- Memory variants unmeasured.
