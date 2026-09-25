# PROGRESS

## Status Snapshot
- Date: 2026-09-25
- Branch: `release/final-polish` (Build)
- HEAD: [#46](https://github.com/Settar-Mengli/robot-agent-arena/pull/46) — battle leave races, persist guards, terminalValue (merged baseline for polish branch)
- Current state: D-033 batches **8–11** closed for v0.1.0 (**D-055**); visitor insight loop (Landing **What we found**, Build/Live under **More ways to play**, Challenge/Results/Leaderboard copy) ready for docs + demo assets on this branch.
- **NEXT:** pause for README screenshots (`docs/media/SHOT-LIST.md`), then PR from `release/final-polish` → verify + drift → merge; operator BYOK smoke on Pages; demo video optional.

## Completed
- Repository baseline through Batch 3 (PR #37 / D-049) + D-050 (PR #38) on main.
- Batch 4 / D-051 (PR #39): M0 UX cleanup; four robustness variants; OpenRouter BYOK Arena opt-in; leaderboard/methodology; prereg + amendments; primary recording 280/280; `batch4.robustness.summary.json` + `leaderboard.v1.json`.
- Batch 5 / D-052: `EnvironmentOf` generality proof (robot adapter + golden); Resonance Seal headless env; suite + baselines + CI drift.
- D-053 / PR #41: App-owned live session lifecycle; Arena/Results opponentMode honesty; save-slot hardening; contrast; CI fences + `permissions: contents: read`.
- PR #42 final polish 1: setup honesty, contrast, stats clamp, OpenRouter-only browser providers, dist URL allowlist + protected paths, demo script.
- PR #43 final polish 2; PR #44 security (CSP + SHA-pinned actions + BYOK tip).
- PR #45 / D-054 UX 2 + clarity follow-up; PR #46 battle leave / persist / terminalValue.
- **D-055:** portfolio cut 0.1.0 — batch 9 narrative closed under D-051; memory curve deferred; docs sync.

Lab pack note: decision-lab.v3.json was frozen at Batch 3; Batch 4 extended evals/fixtures/manifest.json without regenerating the pack, so inputHashes.fixtureManifest differs on regen by design (see decision-lab-pack.test.ts). Users are unaffected; the committed pack is the evidence.

## Open
- Memory variants unmeasured (D-055 defer).
- Heldout-ext freetext deferred (D-047).
- Issue #28 vitest worker noise on long drift steps (assertions still green). Local tip: do not leave `SNAPSHOT_DRIFT=1` in the shell when running plain `npm test`.
- Screenshots + demo video (see `docs/media/SHOT-LIST.md`, `docs/demo-video-script.md`).
- Post-merge BYOK smoke (operator on deployed Pages): (1) open site, (2) Home → **More ways to play** → **Play a live AI with your own key**, (3) enable Live AI, (4) paste OpenRouter key, (5) pick a listed model, (6) play 3 turns, (7) confirm no console errors and keyless path when Live is off.
