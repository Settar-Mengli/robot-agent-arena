# PROGRESS

## Status Snapshot
- Date: 2026-09-24
- Current state: UX 2 / D-054 redesign on `ux2/redesign` (UI-only; fix-pass complete; PR next).
- NEXT: merge UX 2 after Ask audit; then operator screenshots per `docs/demo-video-script.md`, live AI smoke on Pages, demo recording.

## Completed
- Repository baseline through Batch 3 (PR #37 / D-049) + D-050 (PR #38) on main.
- Batch 4 / D-051 (PR #39): M0 UX cleanup; four robustness variants; OpenRouter BYOK Arena opt-in; leaderboard/methodology; prereg + amendments; primary recording 280/280; `batch4.robustness.summary.json` + `leaderboard.v1.json`.
- Batch 5 / D-052: `EnvironmentOf` generality proof (robot adapter + golden); Resonance Seal headless env; suite + baselines + CI drift.
- D-053 / PR #41: App-owned live session lifecycle; Arena/Results opponentMode honesty; save-slot hardening; contrast; CI fences + `permissions: contents: read`.
- PR #42 final polish 1: setup honesty, contrast, stats clamp, OpenRouter-only browser providers, dist URL allowlist + protected paths, demo script.
- PR #43 final polish 2; PR #44 security (CSP + SHA-pinned actions + BYOK tip).

Lab pack note: decision-lab.v3.json was frozen at Batch 3; Batch 4 extended evals/fixtures/manifest.json without regenerating the pack, so inputHashes.fixtureManifest differs on regen by design (see decision-lab-pack.test.ts). Users are unaffected; the committed pack is the evidence.

## Open
- Memory variants unmeasured.
- Heldout-ext freetext deferred (D-047).
- Issue #28 vitest worker noise on long drift steps (assertions still green). Local tip: do not leave `SNAPSHOT_DRIFT=1` in the shell when running plain `npm test`.
- Deferred: screenshots (refresh after UX2 merge), demo-video recording, Watch pack slim, n=35 Compare UI, Lab experiment arms.
- Post-merge BYOK smoke (operator on deployed Pages): (1) open site, (2) Home → Play a live AI with your own key, (3) enable Live AI, (4) paste OpenRouter key, (5) pick a listed model (allowlist still needs operator verification — placeholder `openrouter/free`), (6) play 3 turns, (7) confirm no console errors and that keyless/fallback path still works when Live is off.
