# EVAL

Deterministic eval harness for AGENT ARENA (D-018, D-020).

## Purpose

Measure CPU policies (random, greedy, LLM) on fixed match and decision-snapshot suites without requiring API keys on the committed path.

## How to run

```bash
npm run eval              # baseline (random + greedy), writes evals/out/baseline.json
npm run eval:report       # baseline + regenerate EVAL.md baseline block
npm run eval:replay       # LLM via recorded fixtures (fails on fixture_miss)
npm run eval:record       # local only: call providers and write fixtures
```

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
| all | 120 | 17.50% [11.74%, 25.28%] | 2.50% | 80.00% | 17.88 | -4.80 |
| cpu-fracture | 60 | 10.00% [4.66%, 20.15%] | 5.00% | 85.00% | 15.75 | -5.98 |
| cpu-sentinel-x | 60 | 25.00% [15.78%, 37.23%] | 0.00% | 75.00% | 20.00 | -3.62 |

#### Matches — greedy CPU

| slice | n | CPU win (Wilson 95%) | draw | loss | mean turns | mean HP margin (CPU−player) |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| all | 120 | 10.83% [6.44%, 17.66%] | 11.67% | 77.50% | 17.89 | -4.51 |
| cpu-fracture | 60 | 13.33% [6.91%, 24.17%] | 23.33% | 63.33% | 15.78 | -4.95 |
| cpu-sentinel-x | 60 | 8.33% [3.61%, 18.07%] | 0.00% | 91.67% | 20.00 | -4.07 |

#### Snapshots — random expectation

| n | optimal rate | mean regret | max regret |
| ---: | ---: | ---: | ---: |
| 20 | 50.00% | 1001.0000 | 2003.0000 |

#### Snapshots — greedy

| n | optimal rate | mean regret | max regret |
| ---: | ---: | ---: | ---: |
| 20 | 100.00% | 0.0000 | 0.0000 |

<!-- baseline:end -->

## LLM results

<!-- llm:start -->
Pending — run `npm run eval:record` locally with keys, then `npm run eval:replay`.

Fields to be reported: CPU win/draw/loss with Wilson CI (per split / opponent), snapshot optimal rate and regret, decision-validity %, fallback rates, fixture_miss count, token totals. Latency p50/p95 are omitted in replay mode.
<!-- llm:end -->

## Limitations

- Oracle is a fixed-policy best response, not an equilibrium.
- Snapshot suites are small (n=20 per split).
- Snapshots are drawn from **greedy-CPU play**, so they reflect states that greedy reaches (not the full state space).
- Free-tier model volatility can change live/record results.
- Replay latency is not meaningful.
- Fictional environment vocabulary only.
