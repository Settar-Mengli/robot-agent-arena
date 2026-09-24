# PROGRESS

## Status Snapshot
- Date: 2026-09-23
- Branch: `feat/batch4-robustness-live` (PR #39 / Batch 4, D-051)
- Current state: Batch 4 / D-051 complete — 280 fixtures, robustness summary, leaderboard, methodology null-result copy.
- NEXT: Batch 5 (second environment).

## Completed
- Repository baseline through Batch 3 (PR #37 / D-049) + D-050 (PR #38) on main.
- Batch 4 / D-051 (PR #39): M0 UX cleanup; four robustness variants; OpenRouter BYOK Arena opt-in; leaderboard/methodology; prereg + amendments; primary recording 280/280; `batch4.robustness.summary.json` + `leaderboard.v1.json`.

## Open
- Memory variants unmeasured.
- Heldout-ext freetext deferred (D-047).
- Issue #28 vitest worker noise on long drift steps (assertions still green).
- Deferred: screenshots, demo-video rewrite, Watch pack slim, n=35 Compare UI, Lab experiment arms.
- Post-merge BYOK smoke (operator on deployed Pages): (1) open site, (2) Arena → enable Live AI, (3) paste OpenRouter key, (4) pick a listed model (allowlist still needs operator verification — placeholder `openrouter/free`), (5) play 3 turns, (6) confirm no console errors and that keyless/fallback path still works when Live is off.
