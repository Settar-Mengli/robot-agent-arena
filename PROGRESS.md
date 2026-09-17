# PROGRESS

## Status Snapshot
- Date: 2026-09-17
- HEAD: c30851b (`chore: add MIT license (#7)`) on `main` at branch cut
- Current state: Engine, data, infra, and multi-provider inference client (M-INF) are on `main`. Deterministic seeded engine; shared `resolveTurn`; interactive `startBattle` / `stepBattle` with JSON save/resume; RNG restore; FRACTURE + SENTINEL-X catalog; ESLint engine-purity rules; coverage; CI; ARCHITECTURE + README + MIT LICENSE. No UI yet. Agentic re-scope (D-014–D-019) stands; positioning as agent-design teaching sandbox recorded as D-020 (docs-only; no engine/spine change).
- Verification: `npm run typecheck` / `lint` / `coverage` green; suite ~100 tests
- Working tree: branch `docs/positioning` for this docs-only update

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
- Multi-provider OpenAI-compatible inference client under `src/inference/` (M-INF, PR #6).
- MIT LICENSE (PR #7).

## Current Work
- Docs-only: record D-020 agent-design teaching sandbox positioning (this branch).

## Blockers
- None.

## Tracked Issues
- One npm audit vulnerability remains a tracked later investigation item.
- Do not run `npm audit fix` or upgrade dependencies without explicit approval.

## Changed Files In Current Work
- DECISIONS.md
- README.md
- ROADMAP.md
- PROGRESS.md

## Exact Next Step
**M-AGENT — LLM agent** (+ start **M-EVAL** baseline alongside): battle-state + personality → validated legal move behind the existing `selectCpuSkillId` seam; deterministic bot fallback. Begin a minimal headless eval baseline for win rate / validity / latency / fallback. UI remains deferred until after M-EVAL evidence. Keep the pure engine and its tests untouched.
