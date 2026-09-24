# PROGRESS

## Status Snapshot
- Date: 2026-09-24
- Branch: `feat/batch5-second-env` (Batch 5 / D-052)
- Current state: Batch 5 / D-052 complete — `EnvironmentOf` + robot adapter + shared `evaluateChoices`; Resonance Seal suite n=40 + baselines (keyless).
- NEXT: final polish (screenshots, demo video, issue #28).

## Completed
- Repository baseline through Batch 3 (PR #37 / D-049) + D-050 (PR #38) on main.
- Batch 4 / D-051 (PR #39): M0 UX cleanup; four robustness variants; OpenRouter BYOK Arena opt-in; leaderboard/methodology; prereg + amendments; primary recording 280/280; `batch4.robustness.summary.json` + `leaderboard.v1.json`.
- Batch 5 / D-052: `EnvironmentOf` generality proof (robot adapter + golden); Resonance Seal headless env; suite + baselines + CI drift.

## Open
- Memory variants unmeasured.
- Heldout-ext freetext deferred (D-047).
- Issue #28 vitest worker noise on long drift steps (assertions still green).
- Deferred: screenshots, demo-video rewrite, Watch pack slim, n=35 Compare UI, Lab experiment arms.
- Post-merge BYOK smoke (operator on deployed Pages): (1) open site, (2) Arena → enable Live AI, (3) paste OpenRouter key, (4) pick a listed model (allowlist still needs operator verification — placeholder `openrouter/free`), (5) play 3 turns, (6) confirm no console errors and that keyless/fallback path still works when Live is off.
