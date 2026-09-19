# PROGRESS

## Status Snapshot
- Date: 2026-03-20
- Branch: `feat/m-bench`; base `main` @ `982e8a4`
- Current state: **M-BENCH headless done** (D-032): per-variant manifest (#21), pinned `--models`, repeat-aware fixtures, taxonomy/cost/consistency, `--mode bench` + committed `bench.summary.json` (gemini base on held-out adversarial). Multi-model + grounded gemini adversarial fixtures await operator record. Next: **M-UI part 1**.
- Test count: **282** (`npm run coverage`: 278 passed, 4 skipped)
- Verification: typecheck / lint / coverage; keyless bench + replay
- Working tree: `feat/m-bench` → PR

## Completed
- Repository baseline and governance files exist.
- Legal, safety, naming, architecture, MVP scope, and non-goal constraints are recorded.
- Minimal engine scaffold was completed and pushed in commit 095fa5f.
- Domain types were completed and pushed in commit 3935314.
- Session lifecycle API was completed and pushed in commit 35d743a.
- Session validation guards were completed and pushed in commit 0d37d5a.
- Skill catalog validation helpers were completed and pushed in commit 106a684.
- Documentation ownership was consolidated across ROADMAP, PROGRESS, DECISIONS, and AGENT_RULES.
- Canonical 8-skill MVP catalog was added as data-only engine content.
- Runtime validation ownership was centralized in `src/engine/validation.ts`.
- M3 deterministic simulation was implemented using the existing session lifecycle and seeded placeholder action selection.
- M4 combat constants, combat state, skill effects, fallback action policy, action resolution, and outcome rules were added.
- `resolveBattle` now returns `BattleResult` with final session state, final combatants, ordered turn records, outcome, seed, and total turn count.
- Session lifecycle remains separate from combat resolution; `session.ts` owns lifecycle transitions only.
- Combat, outcome, lifecycle, validation, and deterministic simulation tests were added or updated.
- Shared `resolveTurn` was extracted from `resolveBattle` (commit 5dea82e).
- F2 fixed: battle completion is status-only via `isBattleOver`; turn-cap outcomes apply after the final turn plays; seam parity tests added (commit 5e41922).
- F8 fixed: `validateAgentConfigInput` requires at least one skill so empty loadouts fail at the validation boundary (commit 6d2c014).
- Docs hygiene + ARCHITECTURE.md / README (docs PRs).
- M-INF / M-AGENT / M-EVAL / M-TOOLS delivered (see ROADMAP).
- M-BENCH headless: per-variant manifest, pin+repeat keys, bench metrics, `--mode bench`, D-032 docs.

## In Progress
- PR `feat/m-bench` (closes #21).

## Blocked
- None.

## Deferred
- Multi-model bench rows (operator record with keys).
- Grounded gemini adversarial fixtures for bench axis.
- Memory ablation variants remain unmeasured.
- M-UI (next).

## Changed Files In Current Work
- See `git status` / PR diff on `feat/m-bench`.

## Exact Next Step
**M-UI part 1** (Builder + Arena). Multi-model bench record is optional operator follow-up.
