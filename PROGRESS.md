# PROGRESS

## Status Snapshot
- Date: 2026-09-17
- Branch: `feat/eval-discrimination` (PR open); base `main`
- Current state: M-EVAL complete with discrimination verdict **DISCRIMINATES**; fixture manifest + multi-provider keyless suite-all replay. Decisions D-021–D-026 in force. Next: **M-ENV** (D-025).
- Verification: typecheck / lint / coverage; CI `eval:replay -- --suite all`
- Working tree: `feat/eval-discrimination`

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
- Infra: ESLint 10 flat config with engine-purity rules, v8 coverage, CI workflow (PR #1).
- Interactive driver: `createSeededRngFromState`, `BattleRuntime`, `startBattle` / `stepBattle` (PR #3).
- CPU opponent catalog: FRACTURE and SENTINEL-X in `src/data/opponents.ts` (PR #4).
- Multi-provider OpenAI-compatible inference client under `src/inference/` (M-INF, PR #6); external abort + per-attempt hook (M-AGENT c2).
- MIT LICENSE (PR #7).
- D-020 positioning docs.
- M-AGENT (PR #9): `SelectCpuSkillId` seam; `playAgentTurn` with validation/fallback/budget/trace; greedy baseline; D-021/D-022 docs.
- M-EVAL (PR #10): `src/eval/` harness, snapshot suites, recorded fixtures, Vite `runnerImport` CLI, committed EVAL.md baseline, D-023.

## Current Work
- Discrimination batch docs (D-025 / D-026); environment verdict DISCRIMINATES.

## Blockers
- None.

## Tracked Issues
- One npm audit vulnerability remains a tracked later investigation item.
- Do not run `npm audit fix` or upgrade dependencies without explicit approval.

## Changed Files In Current Work
- See `git status` / PR diff on `feat/eval-discrimination`.

## Exact Next Step
**M-ENV** (D-025 batch 2 / D-026 deferred items). Then M-TOOLS (D-024). UI remains deferred.
