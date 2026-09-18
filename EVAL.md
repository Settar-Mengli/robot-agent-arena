# EVAL

Deterministic eval harness for AGENT ARENA (D-018, D-020).

## Purpose

Measure CPU policies (random, greedy, LLM) on fixed match and decision-snapshot suites without requiring API keys on the committed path.

## How to run

```bash
npm run eval              # baseline (random + greedy), writes evals/out/baseline.json
npm run eval:report       # baseline + regenerate EVAL.md baseline block
npm run eval:replay       # LLM via recorded fixtures (fails on fixture_miss)
npm run eval:record       # local only: call providers, reuse fixtures, write new ones
```

`eval:replay` defaults to `--suite dev` and needs **no API keys** (placeholder provider env is derived from committed fixtures; CI runs the same command). Pass `--suite heldout` / `all` only after a heldout record exists, or replay will fixture-miss. `eval:record` / live also default to `--suite dev` (pass `--suite all` or `heldout` to widen). Record/live use archetype-first stratified match sampling for `--max-matches` (see Findings); **replay still uses first-N-by-id** so committed fixtures stay green until a stratified record run is committed. Fixtures are reused on cache hit (incremental). Runs print a completion summary (including live/non-cached HTTP latency and cache hit counts). Exit code `2` if every decision fell back. Snapshot suites are evaluated by default (`--no-snapshots` to skip). Use `--all-seeds` on record/live to opt into first-N-by-id. Optional `--replay-provider <name>` overrides fixture-derived provider choice.

## Metric definitions

- **Match outcomes:** CPU win / draw / loss rates with Wilson 95% CI on the win rate; mean turns; mean final HP margin (CPU − player).
- **Oracle / snapshots:** at discriminative CPU decision points, an exact memoized **best response vs a fixed player policy** (not a game-theoretic equilibrium). Optimal-move rate = chosen skill ∈ oracle `best`; regret = max value − chosen value.
- **Random snapshot expectation:** analytical uniform average over affordable equipped skills (else `skillIds[0]`), matching the engine picker.
- **LLM:** decision-validity %, fallback reasons, fixture_miss count; latency percentiles are null in replay mode.

## Baseline

<!-- baseline:start -->
### Split: dev

#### Matches — random CPU

| slice | n | CPU win (Wilson 95%) | draw | loss | mean turns | mean HP margin (CPU−player) |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| all | 120 | 5.00% [2.31%, 10.48%] | 9.17% | 85.83% | 17.89 | -5.32 |
| cpu-fracture | 60 | 8.33% [3.61%, 18.07%] | 18.33% | 73.33% | 15.78 | -5.12 |
| cpu-sentinel-x | 60 | 1.67% [0.29%, 8.86%] | 0.00% | 98.33% | 20.00 | -5.52 |

#### Matches — greedy CPU

| slice | n | CPU win (Wilson 95%) | draw | loss | mean turns | mean HP margin (CPU−player) |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| all | 120 | 10.83% [6.44%, 17.66%] | 9.17% | 80.00% | 17.89 | -4.46 |
| cpu-fracture | 60 | 8.33% [3.61%, 18.07%] | 18.33% | 73.33% | 15.78 | -5.12 |
| cpu-sentinel-x | 60 | 13.33% [6.91%, 24.17%] | 0.00% | 86.67% | 20.00 | -3.80 |

#### Snapshots — random expectation

| n | optimal rate | mean regret | max regret |
| ---: | ---: | ---: | ---: |
| 20 | 50.00% | 1001.0000 | 2003.0000 |

#### Snapshots — greedy

| n | optimal rate | mean regret | max regret |
| ---: | ---: | ---: | ---: |
| 20 | 100.00% | 0.0000 | 0.0000 |

### Split: heldout

#### Matches — random CPU

| slice | n | CPU win (Wilson 95%) | draw | loss | mean turns | mean HP margin (CPU−player) |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| all | 120 | 6.67% [3.42%, 12.61%] | 0.00% | 93.33% | 18.60 | -5.09 |
| cpu-fracture | 60 | 11.67% [5.77%, 22.18%] | 0.00% | 88.33% | 17.20 | -6.88 |
| cpu-sentinel-x | 60 | 1.67% [0.29%, 8.86%] | 0.00% | 98.33% | 20.00 | -3.30 |

#### Matches — greedy CPU

| slice | n | CPU win (Wilson 95%) | draw | loss | mean turns | mean HP margin (CPU−player) |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| all | 120 | 9.17% [5.20%, 15.67%] | 11.67% | 79.17% | 18.60 | -4.69 |
| cpu-fracture | 60 | 10.00% [4.66%, 20.15%] | 23.33% | 66.67% | 17.20 | -6.20 |
| cpu-sentinel-x | 60 | 8.33% [3.61%, 18.07%] | 0.00% | 91.67% | 20.00 | -3.18 |

#### Snapshots — random expectation

| n | optimal rate | mean regret | max regret |
| ---: | ---: | ---: | ---: |
| 20 | 50.00% | 0.7500 | 2.0000 |

#### Snapshots — greedy

| n | optimal rate | mean regret | max regret |
| ---: | ---: | ---: | ---: |
| 20 | 50.00% | 0.5000 | 1.0000 |

<!-- baseline:end -->

## LLM results

<!-- llm:start -->
Measured local `eval:record`, suite `heldout`, `--max-matches 6` (archetype-first stratified): 6 distinct matchups — aegis / mnemonic / tempest × greedy / seeded-random vs FRACTURE. Decisions were served by a **mixture** of Gemini, OpenRouter, and Groq (failover).

| metric | value |
| --- | --- |
| decisions | 102 (llm=100, fallback=0, skipped=2) |
| decision-validity | 100% |
| fixture_miss | 0 |
| live latency p50 / p95 (non-cached HTTP) | 206ms / 729ms |
| tokens (prompt / completion / total) | 34074 / 10949 / 45023 |
| newly recorded / cache hits / fixtures on disk | 96 / 30 / 168 |
| snapshots[heldout] optimal / mean regret / invalid | 50% / 0.50 / 0% |

#### Provider attempts (failover)

| provider | ok | fail |
| --- | ---: | --- |
| gemini | 62 | 429×78 |
| openrouter | 32 | (no status)×6 |
| groq | 6 | 0 |

**84 failed attempts produced zero fallbacks** — failover absorbed every miss.

#### Matches — random vs greedy vs LLM (same 6 scenarios)

Independently verified: greedy CPU matches the LLM on **every** row (result and turn count). Random differs only on `aegis__greedy` (player-victory instead of draw). Held-out snapshot optimality: greedy 50% / 0.50 regret (identical to LLM); random 50% / 0.75.

| scenario | random | greedy | LLM |
| --- | --- | --- | --- |
| aegis__greedy__fracture__s101 | player-victory / 20t | draw / 20t | draw / 20t |
| mnemonic__greedy__fracture__s101 | player-victory / 20t | player-victory / 20t | player-victory / 20t |
| tempest__greedy__fracture__s101 | player-victory / 11t | player-victory / 11t | player-victory / 11t |
| aegis__seeded-random__fracture__s101 | cpu-victory / 20t | cpu-victory / 20t | cpu-victory / 20t |
| mnemonic__seeded-random__fracture__s101 | player-victory / 20t | player-victory / 20t | player-victory / 20t |
| tempest__seeded-random__fracture__s101 | player-victory / 11t | player-victory / 11t | player-victory / 11t |

**Headline:** On this task the deterministic greedy bot is indistinguishable from the LLM on both tactical optimality (held-out snapshots) and match outcomes across these six matchups. **The LLM shows no measured advantage on this task today.**
<!-- llm:end -->

## Findings

- **Held-out LLM vs greedy:** On the stratified held-out sample (n=6 matchups, FRACTURE only), greedy matches the LLM on all six outcomes/turn counts and on snapshot optimality (50% / 0.50). **No measured LLM advantage** on this task today. Pre-registered next test: M-TOOLS grounding ablation (D-024).
- **Reliability:** 84 failed provider attempts (mostly Gemini 429s) produced **zero** decision fallbacks; live latency p50 was 206ms. Per-provider attempt/decision attribution is now in the eval summary JSON.
- **Held-out independence (fixed):** Earlier seed-only held-out duplicated dev snapshot states 20/20; disjoint archetypes (`aegis` / `tempest` / `mnemonic`) now yield state-key overlap **0**.
- **Keyless replay + CI:** `eval:replay` derives placeholder provider env from fixture hosts and is enforced in CI. Default replay is first-N-by-id (dev fixtures); held-out fixtures were recorded under stratified selection — `replay --suite all` first-N heldout rows can fixture-miss until selection/fixtures align.
- **Sampling:** Record/live use **archetype-first** stratified selection. Replay stays first-N-by-id for committed first-N fixtures.
- **Snapshots:** Dev snapshots remain 100% greedy-optimal (non-discriminating). Held-out snapshots sit at 50% for greedy and LLM.
- **Providers:** Cloudflare JSON double-escape; Mistral free-tier 429s / wrapping; OpenRouter free-pool limits. This held-out run used Gemini → OpenRouter → Groq failover.

## Limitations

- Oracle is a fixed-policy best response, not an equilibrium.
- Held-out LLM match sample is small (**n=6**) and all six used **FRACTURE** (archetype-first stratification varies archetype and policy before opponent, so SENTINEL-X was not sampled at n=6).
- “The LLM” here is a **mixture of three models** via failover, not a single system under test.
- Snapshot optimality at n=20 has **no confidence interval**.
- Snapshots are drawn from **greedy-CPU play**, so they reflect states that greedy reaches (not the full state space).
- Free-tier model volatility can change live/record results.
- Replay latency is not meaningful.
- Fictional environment vocabulary only.
