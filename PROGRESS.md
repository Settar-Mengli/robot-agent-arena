# PROGRESS

## Status Snapshot
- Date: 2026-09-23
- Branch: `feat/batch4-robustness-live` (Phase 1 code + prereg; awaiting operator recording)
- Current state: Batch 4 / D-051 Phase 1 — M0 cleanup + experiment variants + BYOK/leaderboard/methodology UI. **Pre-registration:** `docs/preregistration-batch4.md`. **Next:** operator Windows 1–2, then Phase 2 fixtures/summaries.
- Verification: typecheck / lint / vitest (501 pass) / build (incl. base path) green locally.

## Completed
- Repository baseline through Batch 3 (PR #37 / D-049) + D-050 (PR #38) on main.
- Batch 4 Phase 1 (this branch): M0 UX cleanup; `base-repeat`/`perturb`/`advctx`/`info-partial`; OpenRouter BYOK Arena opt-in; leaderboard/methodology views; prereg doc.

## Open
- Operator recording (Batch 4 Windows 1–2); Phase 2 summaries/leaderboard JSON/D-051 text.
- Memory variants unmeasured.
- Heldout-ext freetext deferred (D-047).
- Issue #28 vitest worker noise on long drift steps (assertions still green).
- Deferred: screenshots, demo-video rewrite, Watch pack slim, n=35 Compare UI, Lab experiment arms.
