# Case study — AGENT ARENA Evidence + Ship

**Status:** v0.1.0 portfolio cut ([D-055](../DECISIONS.md#d-055-portfolio-cut-v010-final-polish-closure)). Locked batches **8–11** done; batch **9** closed under [D-051](../DECISIONS.md) (memory / full information-scaling curve deferred).

## Problem

Agent designs are often judged by vibe. AGENT ARENA instead measures decision quality against an **exact oracle** (best response vs a fixed player policy — not a game-theoretic equilibrium) in a deterministic robot-battle reference environment. A second reference environment (**Resonance Seal**, D-052) proves the shared `EnvironmentOf` interface; Seal regret scale ≠ robot battle — never compare across envs.

## Method

- Snapshot suites of discriminative CPU decision points (standard / pivotal / adversarial).
- Held-out adversarial suite (**n=13** distinct states, D-035) plus additive **heldout-ext** suite (**n=35**, D-044; honest n after widen-once seed band 201–280).
- Pinned models only for comparative claims (D-036): `gemini:gemini-3.5-flash-lite` and `groq:openai/gpt-oss-20b` (D-046).
- Wilson 95% CI on optimal rate; seeded bootstrap CI on mean regret; **insufficient evidence** when n&lt;30 or Wilson width ≥0.40.
- Decision Lab pack **v3** (offline JSON) for Challenge / Situations / Compare / Diagnostics — recorded-only. Arena has optional opt-in live AI (user OpenRouter key, memory-only); Watch and leaderboard are recorded-only. Live BYOK is **never** ranked evidence (D-055).
- Batch 4 / D-051 robustness arms (perturb, advctx, info-partial, base-repeat) on heldout-ext **n=35** — see [EVAL.md — Batch 4](../EVAL.md#batch-4-d-051-robustness-heldout-ext-n35).
- Batch 5 / D-052 Resonance Seal committed baselines **n=40** — see [EVAL.md — Batch 5](../EVAL.md#batch-5-d-052-resonance-seal-second-reference-environment).

## Oracle assumptions

- Perspective: CPU.
- Fixed player policy from the scenario (greedy or seeded-random).
- Exact memoized best response with node caps; ties reported as multiple `best` ids.

## Results (phase 2 — recorded + keyless)

| Surface | Status |
| --- | --- |
| Pinned gemini + groq × base/grounded on n=13 | Published — see EVAL.md / bench.summary.json (`singleModelPending: false`) |
| Heldout-ext (n=35) base/grounded both pins | Published (`singleModelPending: false`) |
| Free-text (`agent-v5-freetext`) | Recorded n=13 both pins; ext deferred (D-047) |
| Confidence intervals | Wilson + bootstrap on bench rows; Lab Compare insufficient-evidence labels |
| Gemini base≡grounded on ext (34.3%/1.23) | **Genuine identical choices** (35/35 same skillId; distinct `agent-v1` vs `agent-v2-grounded`) |
| Batch 4 / D-051 robustness (heldout-ext n=35) | Null result: rewording, fixed rumor, partial facts not separable vs base; Gemini **0/35** flips; Groq **1/35** (same snapshot as base-repeat noise) — `evals/out-committed/batch4.robustness.summary.json` |
| Resonance Seal (D-052) | Committed greedy/random baselines **n=40** — `evals/out-committed/resonance-seal.baselines.v1.json` |

Do not over-claim: n=13 rows remain **insufficient evidence**; ext n=35 clears the n/width gate but is still one suite/product cohort. Small-n suites **cannot rank models**.

## Limitations

- Small n → insufficient evidence labels; small-n suites cannot rank models (D-055).
- Seed correlation / suite reselection remain known limitations on **existing** suites (D-026); ext suite is additive only.
- Memory variants and full information-scaling curve **unmeasured** (D-055).
- Replay latency is null; live profile is separate and live-call-only.
- Pages demo Lab / Challenge / Watch / leaderboard are recorded-only; Arena live AI is optional opt-in (user OpenRouter key, memory-only) and is **never** ranked evidence.
- Oracle is fixed-policy best response, not equilibrium (D-037 / D-055).

## Reproduce (keyless)

```bash
npm run eval:replay -- --suite heldout --variants base,grounded --snapshot-suite adversarial --models gemini:gemini-3.5-flash-lite
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite --variants base,grounded --snapshot-suite adversarial --max-matches 0
npm run lab:pack
npm run preview:pages
```

Operator live record requires local keys only (`eval:record`); not part of the keyless CI path.
