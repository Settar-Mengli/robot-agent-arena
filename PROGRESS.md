# PROGRESS

## Status Snapshot
- Date: 2026-09-20
- Branch: `feat/ui-builder` (execution **B.1**); base `main` includes UI foundation (#32)
- Current state: **B.1 implemented** — Vite app shell under `src/ui`, Tailwind 4.3.3, Builder → validated `AgentConfig` via engine validation, coverage includes `.tsx` / excludes `*.test.*`, CI `npm run build`. Battle-view store untouched.
- Next: Operator production preview smoke (`npm run build` + `npx vite preview`); then execution **B.2** (Arena + results; resolve UI turn-result contract first).
- Verification (agent): typecheck / lint / vitest (330 passed / 6 skipped) / coverage report keys / build / `eval:replay --suite all` (fixture_miss 0). **Preview smoke: pending operator results.**

## Completed
- Repository baseline and governance files exist.
- Legal, safety, naming, architecture, MVP scope, and non-goal constraints are recorded.
- Engine / inference / agent / eval spine through M-BENCH (see prior commits).
- **A1 hardening** (PR #27); **A2** (`grounded-v2` / pinned ablation).
- **D-035** distinct-state snapshot suites; **D-036** pinning enforcement.
- **A3** environment interface (`src/env`), adapter-only port, committed differential proof.
- **Batch B foundation** (PR #32) — UI layer fence, deps, tsconfig split, vitest projects, turn-result type, store contract.
- **Execution B.1** — app shell + Builder + Tailwind + CI build step.

## Open
- Operator browser smoke on Vite preview (B.1 acceptance incomplete until results supplied).
- Execution **B.2**: Arena + results; UI turn-result contract design (CPU step + optional genuine agent trace).
- A-to-Z recon; later roadmap items.
- Multi-model bench proof (`singleModelPending` still true).
- Memory variants unmeasured.
- README status line still stale (edit requires AGENT_RULES approval).
