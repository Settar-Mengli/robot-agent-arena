# PROGRESS

## Status Snapshot
- Date: 2026-09-18
- Branch: `docs/d033-direction`; base `main` @ `982e8a4`
- Current state: Docs-only lock of **D-033** (supersedes D-025 scope/batch order). D-026 closed won't-fix. Coach cut. M-BENCH headless remains **in review** (PR #23). Next after #23: **batch 4 — correctness hardening** (not UI).
- Test count: **258** (`npm run coverage`: 255 passed, 3 skipped)
- Verification: typecheck / lint / coverage (all green)
- Working tree: `docs/d033-direction` (six docs files only)

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
- M-AGENT (PR #9): `playAgentTurn` with validation/fallback/budget/trace; greedy baseline; D-021/D-022 docs.
- M-EVAL (PR #10): eval harness, snapshot suites, fixtures, EVAL.md baseline, D-023.
- Discrimination + fixture manifest + multi-provider keyless suite-all replay (PR #15); D-025/D-026.
- M-TOOLS (PR #16): grounding, memory, opt-in variants, ablation harness; D-027.
- Pivotal snapshot suites + auditable decisions + D-028 (PR #17).
- Adversarial snapshot suites + D-029 (PR #18); min regret 1 (PR #19).
- M-TOOLS ablation published (D-030) and metric choice (D-031).
- Docs reconcile (PR #22): public docs vs measured reality.

## Current Work
- D-033: lock revised product direction (11-batch plan; BYOK / Arena race / coach cut; D-026 won't-fix). Docs only.

## Blockers
- None.

## Tracked Issues
- One npm audit vulnerability remains a tracked later investigation item.
- Do not run `npm audit fix` or upgrade dependencies without explicit approval.
- D-026 closed as won't-fix under D-033 (known limitations: small n, seed correlation).
- Memory ablation variants remain unmeasured.
- PR #23 (M-BENCH) in review; pin protocol lands with that PR (not yet on `main`).

## Changed Files In Current Work
- `DECISIONS.md`, `ROADMAP.md`, `PROGRESS.md`, `README.md`, `ARCHITECTURE.md`, `EVAL.md`

## Exact Next Step
- Land PR #23 (M-BENCH), then **batch 4 — correctness hardening** (CI regen gates, MemoScope, grounding, greedy→grounding, pricing, `.env.example`, weak tests). Environment interface is batch 5.
