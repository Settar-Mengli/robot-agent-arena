# PROGRESS

## Status Snapshot
- Date: 2026-09-21
- Branch: `feat/ui-arena` (execution **B.2**)
- Current state: **B.2 complete** — Arena + results on the App-owned epoch store; `UiTurnResult`; greedy CPU from `runtime.session.cpu`; Builder Continue-when-validated; restart/clear with preserved draft; deferred-promise leave race covered in tests.
- Next: **B.3** (fixture-replayed LLM UI) → **B.4** (MVP save slot).
- Verification (agent): typecheck / lint / vitest / coverage / build / `eval:replay --suite all` (run at commit gate).
- Browser smoke (**operator-observed**, production `build` + `vite preview`): Builder → setup (incl. SENTINEL-X) → battle through turn-limit results → restart; unaffordable/fallback progression; return to Builder preserves configuration; console clean.

## Completed
- Repository baseline and governance files exist.
- Legal, safety, naming, architecture, MVP scope, and non-goal constraints are recorded.
- Engine / inference / agent / eval spine through M-BENCH (see prior commits).
- **A1 hardening** (PR #27); **A2** (`grounded-v2` / pinned ablation).
- **D-035** distinct-state snapshot suites; **D-036** pinning enforcement.
- **A3** environment interface (`src/env`), adapter-only port, committed differential proof.
- **Batch B foundation** (PR #32) — UI layer fence, deps, tsconfig split, vitest projects, turn-result type, store contract.
- **Execution B.1** (PR #33) — app shell + Builder + Tailwind + CI build.
- **Execution B.2** — Arena + results; D-042 UI turn contract; greedy adapter; flow + leave-while-pending tests.

## Open
- Execution **B.3**: fixture-replayed LLM UI (browser-safe; D-033 default path).
- Execution **B.4**: MVP localStorage save slot.
- A-to-Z recon; later roadmap items (diagnostic / BYOK / second env).
- Multi-model bench proof (`singleModelPending` still true).
- Memory variants unmeasured.
- README status line still stale (edit requires AGENT_RULES approval).
