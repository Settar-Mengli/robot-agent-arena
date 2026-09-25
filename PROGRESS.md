# PROGRESS

## Status Snapshot
- Date: 2026-09-25
- Current state: UX 2 / D-054 UI clarity follow-up complete on `ux2/redesign` (PR #45): shared readability, explained modes and moves, scannable evidence, and mobile fixes.
- NEXT: commit/push the verified UI follow-up, require PR #45 verify + drift checks, merge to main, and verify Pages deployment. Then refresh demo assets and complete the real-key operator smoke.

## Completed
- Repository baseline through Batch 3 (PR #37 / D-049) + D-050 (PR #38) on main.
- Batch 4 / D-051 (PR #39): M0 UX cleanup; four robustness variants; OpenRouter BYOK Arena opt-in; leaderboard/methodology; prereg + amendments; primary recording 280/280; `batch4.robustness.summary.json` + `leaderboard.v1.json`.
- Batch 5 / D-052: `EnvironmentOf` generality proof (robot adapter + golden); Resonance Seal headless env; suite + baselines + CI drift.
- D-053 / PR #41: App-owned live session lifecycle; Arena/Results opponentMode honesty; save-slot hardening; contrast; CI fences + `permissions: contents: read`.
- PR #42 final polish 1: setup honesty, contrast, stats clamp, OpenRouter-only browser providers, dist URL allowlist + protected paths, demo script.
- PR #43 final polish 2; PR #44 security (CSP + SHA-pinned actions + BYOK tip).

Lab pack note: decision-lab.v3.json was frozen at Batch 3; Batch 4 extended evals/fixtures/manifest.json without regenerating the pack, so inputHashes.fixtureManifest differs on regen by design (see decision-lab-pack.test.ts). Users are unaffected; the committed pack is the evidence.

## UI clarity follow-up (2026-09-25)
- Changed: shared App layout/styles and Home mode descriptions; Results actions before the log; catalog-backed MoveFacts; Challenge resource cards, recorded energy costs, visible selection guidance and reveal lock; Builder selected count and accurate required-profile guidance; separated Advanced control; aligned Compare/Diagnostics summaries; chart legend and constrained Methodology prose.
- Existing Builder validation requires all five profile fields. Copy now reflects that requirement; validation errors open the existing profile disclosure without changing form values, validation rules, or Continue behavior.
- Browser verification caught intrinsic width from the hidden leaderboard table. A clipped block wrapper preserves table semantics without expanding mobile width. Challenge controls stay below move cards on narrow screens.
- Protected code/data diff: engine, environments, agent/inference/evaluation logic, recorded packs/fixtures, storage/store, dependencies and CI unchanged. Live integration is unchanged by this follow-up.
- Validation: typecheck + lint; full coverage suite (601 passed, 7 intentionally skipped at that run); 37 focused move/Builder/Challenge regressions after final profile guidance; 4 leaderboard tests; root and Pages-prefix production builds + URL allowlist; whitespace checks; independent code review.
- Production Edge browser check: 31 checkpoints across 1440px and 380px, plus 200% text sizing; no horizontal overflow or unexpected console/page errors. Verified challenge/reveal/reset, keyboard tabs, Watch controls, Builder/setup, complete battle/restart, save/load, and mocked live-provider failure followed by Load returning to CPU. No actual API key or provider call used.
- Release gate: GitHub verify + drift must pass on the final pushed commit before merge. Real-key model availability remains the existing operator check below.

## Open
- Memory variants unmeasured.
- Heldout-ext freetext deferred (D-047).
- Issue #28 vitest worker noise on long drift steps (assertions still green). Local tip: do not leave `SNAPSHOT_DRIFT=1` in the shell when running plain `npm test`.
- Deferred: screenshots (refresh after UX2 merge), demo-video recording, Watch pack slim, n=35 Compare UI, Lab experiment arms.
- Post-merge BYOK smoke (operator on deployed Pages): (1) open site, (2) Home → Play a live AI with your own key, (3) enable Live AI, (4) paste OpenRouter key, (5) pick a listed model (allowlist still needs operator verification — placeholder `openrouter/free`), (6) play 3 turns, (7) confirm no console errors and that keyless/fallback path still works when Live is off.
