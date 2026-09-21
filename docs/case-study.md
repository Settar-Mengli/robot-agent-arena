# Case study — AGENT ARENA Evidence + Ship

## Problem

Agent designs are often judged by vibe. AGENT ARENA instead measures decision quality against an **exact oracle** (best response vs a fixed player policy — not a game-theoretic equilibrium) in a deterministic robot-battle reference environment.

## Method

- Snapshot suites of discriminative CPU decision points (standard / pivotal / adversarial).
- Held-out adversarial suite (**n=13** distinct states, D-035) plus additive **heldout-ext** suite (D-044; honest n after widen-once seed band 201–280).
- Pinned models only for comparative claims (D-036): `gemini:gemini-3.5-flash-lite` and `groq:openai/gpt-oss-20b` (D-046).
- Wilson 95% CI on optimal rate; seeded bootstrap CI on mean regret; **insufficient evidence** when n&lt;30 or Wilson width ≥0.40.
- Decision Lab pack **v2** (offline JSON) for Browse / Inspector / Compare — static demo, **no live AI**.

## Oracle assumptions

- Perspective: CPU.
- Fixed player policy from the scenario (greedy or seeded-random).
- Exact memoized best response with node caps; ties reported as multiple `best` ids.

## Results (phase 1 / pending operator record)

| Surface | Status |
| --- | --- |
| Pinned gemini base/grounded on n=13 | Published in EVAL.md / bench.summary.json |
| Groq second pin | **Pending operator record** (`singleModelPending: true`) |
| Heldout-ext LLM rows | **Pending operator record** |
| Free-text (`agent-v5-freetext`) | Code shipped; fixtures pending / may cut (D-047) |
| Confidence intervals | Wired in metrics, bench rows, Lab Compare |

Do not invent multi-model numbers before fixtures exist.

## Limitations

- Small n → insufficient evidence labels.
- Seed correlation / suite reselection remain known limitations on **existing** suites (D-026); ext suite is additive only.
- Replay latency is null; live profile is separate and live-call-only.
- Pages demo is static recorded evidence.

## Reproduce (keyless)

```bash
npm run eval:replay -- --suite heldout --variants base,grounded --snapshot-suite adversarial --models gemini:gemini-3.5-flash-lite
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite --variants base,grounded --snapshot-suite adversarial --max-matches 0
npm run lab:pack
npm run preview:pages
```

Operator live record (local keys only) — see PROGRESS / phase-1 STOP runbook.
