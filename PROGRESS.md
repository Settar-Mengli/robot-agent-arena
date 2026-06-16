# PROGRESS

## Status Snapshot
- Date: 2026-06-16
- Baseline commit before M4: 6fcb852 (`feat: add deterministic battle simulation`)
- Current state: M4 deterministic combat engine vertical slice is implemented and verified locally
- Verification: `npm run typecheck` passed; `npm test` passed with 7 test files and 73 tests
- Audit verdict: no critical architecture conflict found

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

## Current Work
- M4 deterministic combat engine vertical slice is complete and ready for commit and push.

## Blockers
- None.

## Tracked Issues
- One npm audit vulnerability remains a tracked later investigation item.
- Do not run `npm audit fix` or upgrade dependencies during the current engine milestone.

## Changed Files In Current Work
- ROADMAP.md
- PROGRESS.md
- DECISIONS.md
- src/engine/constants.ts
- src/engine/types.ts
- src/engine/skills.ts
- src/engine/validation.ts
- src/engine/session.ts
- src/engine/simulation.ts
- src/engine/combat.ts
- src/engine/outcome.ts
- src/engine/index.ts
- src/__tests__/constants.test.ts
- src/__tests__/skill-catalog.test.ts
- src/__tests__/session-lifecycle.test.ts
- src/__tests__/simulation.test.ts
- src/__tests__/combat.test.ts
- src/__tests__/outcome.test.ts

## Exact Next Step
After commit and push, plan M5 UI integration using the completed deterministic engine API, while keeping React, Zustand, browser APIs, persistence, reports, and other UI concerns outside `src/engine`.
