# PROGRESS

## Status Snapshot
- Date: 2026-09-19
- Branch: `fix/duplicate-state-suites`; base `main` @ `b0dac3c`
- Current state: **D-035 shipped (code + regenerated suites)**. Snapshot suites assert distinct decision states; match Wilson/headroom use distinct battles/states. **LLM ablation + bench rows pending** operator re-record on new adversarial suite (n=13). D-034 grounded-v2 results still pending keys.
- Test count: **299** (`npm run coverage`: 295 passed, 4 skipped)
- Verification: typecheck / lint / coverage / SNAPSHOT_DRIFT drift-guards (byte-equality never weakened) / `eval:replay --suite all` (fixture_miss 0; snapshot **invalid** rates high on new states — fixtures do not cover them)
- Working tree: commits on `fix/duplicate-state-suites` (do not merge until PR checks green)

## Operator re-record (keys required)

```powershell
npm run eval:record -- --suite heldout --variants base,grounded,grounded-v2 --snapshot-suite adversarial --max-matches 2
```

Quota projection: `models=1 variants=3 snapshots=13 matches=2 × ~17 × consistency=1 → 141 calls (cap 300)`.

Bench-only refill:

```powershell
npm run eval:record -- --suite heldout --variants base,grounded --snapshot-suite adversarial --max-matches 0 --models gemini:gemini-3.5-flash-lite
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite --variants base,grounded
```

Quota: `1 × 2 × 13 = 26` calls.

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
- D-033 product direction lock (PR #24): 11-batch plan; coach cut; D-026 won't-fix.
- D-033 execution grouping (PR #25): locked batches → A–E.
- M-BENCH headless (PR #23): per-variant manifest, pin+repeat keys, bench metrics, `--mode bench`, D-032; pin-mismatch guard.
- Docs: split execution batch A into A1/A2/A3; pre-register D-034 (PR #26).
- **A1 hardening** (PR #27): greedy→grounding (proven); MemoScope maxTurns+catalog; CI `drift` job; pricing/env/sanitize-on-record; pinned published tests.
- **A2 code** (`feat/a2-grounding-correction`): `computeGroundedFactsV2` / `agent-v4-grounded` / `grounded-v2`; unmodelled marker + greedy skip; historical `agent-v2-grounded` preserved.

## Current Work
- A2 code complete; EVAL D-034 results table empty pending operator record.

## Blockers
- Operator record run with API keys required to fill D-034 results.

## Tracked Issues
- One npm audit vulnerability remains a tracked later investigation item.
- Do not run `npm audit fix` or upgrade dependencies without explicit approval.
- D-026 closed as won't-fix under D-033 (known limitations: small n, seed correlation).
- Memory ablation variants remain unmeasured.
- Multi-model bench rows await operator record.

## Changed Files In Current Work
- A2 scope: `src/agent/**` (grounding, prompt, llm-turn, types, greedy), `src/eval/policies.ts`, listed tests, DECISIONS / ROADMAP / PROGRESS / EVAL ablation section

## Exact Next Step
- Operator: `npm run eval:record -- --suite heldout --variants base,grounded-v2 --snapshot-suite adversarial --max-matches 2` (quota → 108 calls). Then publish D-034 results in EVAL.md. Then A3.
