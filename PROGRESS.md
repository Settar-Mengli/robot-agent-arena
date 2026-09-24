# PROGRESS

## Status Snapshot
- Date: 2026-09-24
- Current state: main includes Batch 5 (PR #40, D-052) and D-053 / PR #41 (live session lifecycle + honesty).
- NEXT: final polish (setup honesty / contrast / CI allowlists / demo script — this PR), then screenshots and demo recording.

## Completed
- Repository baseline through Batch 3 (PR #37 / D-049) + D-050 (PR #38) on main.
- Batch 4 / D-051 (PR #39): M0 UX cleanup; four robustness variants; OpenRouter BYOK Arena opt-in; leaderboard/methodology; prereg + amendments; primary recording 280/280; `batch4.robustness.summary.json` + `leaderboard.v1.json`.
- Batch 5 / D-052: `EnvironmentOf` generality proof (robot adapter + golden); Resonance Seal headless env; suite + baselines + CI drift.
- D-053 / PR #41: App-owned live session lifecycle; Arena/Results opponentMode honesty; save-slot hardening; contrast; CI fences + `permissions: contents: read`.

Lab pack note: decision-lab.v3.json was frozen at Batch 3; Batch 4 extended evals/fixtures/manifest.json without regenerating the pack, so inputHashes.fixtureManifest differs on regen by design (see decision-lab-pack.test.ts). Users are unaffected; the committed pack is the evidence.

## Open
- Memory variants unmeasured.
- Heldout-ext freetext deferred (D-047).
- Issue #28 vitest worker noise on long drift steps (assertions still green). Local tip: do not leave `SNAPSHOT_DRIFT=1` in the shell when running plain `npm test`.
- Deferred: screenshots, demo-video recording, Watch pack slim, n=35 Compare UI, Lab experiment arms.
- Post-merge BYOK smoke (operator on deployed Pages): (1) open site, (2) Arena → enable Live AI, (3) paste OpenRouter key, (4) pick a listed model (allowlist still needs operator verification — placeholder `openrouter/free`), (5) play 3 turns, (6) confirm no console errors and that keyless/fallback path still works when Live is off.
