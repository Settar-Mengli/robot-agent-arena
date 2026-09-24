# Case study — AGENT ARENA Evidence + Ship

## Problem

Agent designs are often judged by vibe. AGENT ARENA instead measures decision quality against an **exact oracle** (best response vs a fixed player policy — not a game-theoretic equilibrium) in a deterministic robot-battle reference environment.

## Method

- Snapshot suites of discriminative CPU decision points (standard / pivotal / adversarial).
- Held-out adversarial suite (**n=13** distinct states, D-035) plus additive **heldout-ext** suite (D-044; honest n after widen-once seed band 201–280).
- Pinned models only for comparative claims (D-036): `gemini:gemini-3.5-flash-lite` and `groq:openai/gpt-oss-20b` (D-046).
- Wilson 95% CI on optimal rate; seeded bootstrap CI on mean regret; **insufficient evidence** when n&lt;30 or Wilson width ≥0.40.
- Decision Lab pack **v3** (offline JSON) for Challenge / Situations / Compare / Diagnostics — recorded-only. Arena has optional opt-in live AI (user OpenRouter key, memory-only); Watch and leaderboard are recorded-only.

## Oracle assumptions

- Perspective: CPU.
- Fixed player policy from the scenario (greedy or seeded-random).
- Exact memoized best response with node caps; ties reported as multiple `best` ids.

## Results (phase 2 — recorded + keyless)

| Surface | Status |
| --- | --- |
| Pinned gemini + groq × base/grounded on n=13 | Published — see EVAL.md / bench.summary.json |
| Heldout-ext (n=35) base/grounded both pins | Published (`singleModelPending: false`) |
| Free-text (`agent-v5-freetext`) | Recorded n=13 both pins; ext deferred (D-047) |
| Confidence intervals | Wilson + bootstrap on bench rows; Lab Compare insufficient-evidence labels |
| Gemini base≡grounded on ext (34.3%/1.23) | **Genuine identical choices** (35/35 same skillId; distinct `agent-v1` vs `agent-v2-grounded`) |

Do not over-claim: n=13 rows remain **insufficient evidence**; ext n=35 clears the n/width gate but is still one suite/product cohort.

## Limitations

- Small n → insufficient evidence labels.
- Seed correlation / suite reselection remain known limitations on **existing** suites (D-026); ext suite is additive only.
- Replay latency is null; live profile is separate and live-call-only.
- Pages demo Lab / Challenge / Watch / leaderboard are recorded-only; Arena live AI is optional opt-in (user OpenRouter key, memory-only).

## Reproduce (keyless)

```bash
npm run eval:replay -- --suite heldout --variants base,grounded --snapshot-suite adversarial --models gemini:gemini-3.5-flash-lite
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite --variants base,grounded --snapshot-suite adversarial --max-matches 0
npm run lab:pack
npm run preview:pages
```

Operator live record (local keys only) — see PROGRESS / phase-1 STOP runbook.
