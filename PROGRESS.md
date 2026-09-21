# PROGRESS

## Status Snapshot
- Date: 2026-09-21
- Branch: `feat/decision-lab` (execution **B.2d**)
- Current state: **B.2d Decision Lab complete** (partial diagnostic slice) — offline pack export + Lab Browse/Inspector/Compare/report; Arena greedy + Builder module clarity; B.2 Arena/results remain. Locked batch 8 / execution C **not** complete. **B.3** / **B.4** not started.
- Next: **B.3** (fixture-replayed LLM UI) → **B.4** (MVP save slot).
- Verification (agent): typecheck / lint / vitest / coverage / build / `eval:replay --suite all` / `lab:pack` drift (run at commit gate).
- Browser smoke (**operator-observed**, production `build` + `vite preview`): Lab load → inspect → compare (n/exclusions) → download report; Builder/Arena greedy label; console clean; Lab makes no network calls.

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
- **Execution B.2d** — Decision Lab evidence pack + inspector/compare UI (D-043); does not finish batch 8 / C.

## Open
- Execution **B.3**: fixture-replayed LLM UI (browser-safe; D-033 default path).
- Execution **B.4**: MVP localStorage save slot.
- Locked batch 8 / execution C full diagnostics (B.2d is partial only).
- A-to-Z recon; later roadmap items (BYOK / second env).
- Multi-model bench proof (`singleModelPending` still true).
- Memory variants unmeasured.
