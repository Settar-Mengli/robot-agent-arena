# PROGRESS

## Status Snapshot
- Date: 2026-09-16
- HEAD: 6d2c014 (`fix(engine): require at least one skill in agent validation (F8)`)
- Current state: Engine convergence pass complete on `main` — `resolveTurn` is the shared per-turn orchestrator; F2 (status-only `isBattleOver`) and F8 (min-1 skill validation) are fixed; suite includes seam parity tests
- Verification: `npm run typecheck` passed; `npm test` passed with 8 test files and 76 tests
- Working tree: clean on `main`, up to date with `origin/main`

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

## Current Work
- None. Convergence pass is complete and pushed to `origin/main`.

## Blockers
- None.

## Tracked Issues
- One npm audit vulnerability remains a tracked later investigation item.
- Do not run `npm audit fix` or upgrade dependencies without explicit approval.

## Changed Files In Current Work
- None.

## Exact Next Step
Infra sprint first (CI + ESLint + branch/PR flow + ARCHITECTURE.md/README), then plan M5 UI integration. UI packages (React, Tailwind, Zustand) are not installed yet; the CPU opponent catalog (FRACTURE and SENTINEL-X) is not built. Keep React, Zustand, browser APIs, persistence, reports, and other UI concerns outside `src/engine`.
