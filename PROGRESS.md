# PROGRESS

## Status Snapshot
- Date: 2026-09-20
- Branch: `feat/ui-builder` (execution **B.1**); base `main` includes UI foundation (#32)
- Current state: **B.1 complete pending PR merge** — Vite app shell under `src/ui`, Tailwind 4.3.3, Builder → validated `AgentConfig` via engine validation (results invalidate on edit), coverage includes `.tsx` / excludes `*.test.*`, CI `npm run build`. Battle-view store untouched.
- Next: Merge B.1 PR when CI green; then execution **B.2** (Arena + results; resolve UI turn-result contract first).
- Verification (agent): typecheck / lint / vitest / coverage report keys / build / `eval:replay --suite all` (fixture_miss 0).
- Browser smoke (**operator-observed**, production preview): shell/Builder render; validation works; skill selection / limit disable works; results clear immediately on edits; agentId stays stable; console clean (favicon 404 resolved by data-URI icon).

## Completed
- Repository baseline and governance files exist.
- Legal, safety, naming, architecture, MVP scope, and non-goal constraints are recorded.
- Engine / inference / agent / eval spine through M-BENCH (see prior commits).
- **A1 hardening** (PR #27); **A2** (`grounded-v2` / pinned ablation).
- **D-035** distinct-state snapshot suites; **D-036** pinning enforcement.
- **A3** environment interface (`src/env`), adapter-only port, committed differential proof.
- **Batch B foundation** (PR #32) — UI layer fence, deps, tsconfig split, vitest projects, turn-result type, store contract.
- **Execution B.1** — app shell + Builder + Tailwind + CI build step + follow-up invalidation/favicon/a11y.

## Open
- Execution **B.2**: Arena + results; UI turn-result contract design (CPU step + optional genuine agent trace).
- A-to-Z recon; later roadmap items.
- Multi-model bench proof (`singleModelPending` still true).
- Memory variants unmeasured.
- README status line still stale (edit requires AGENT_RULES approval).
