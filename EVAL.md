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

`eval:record` / live default to `--suite dev` (pass `--suite all` or `heldout` to widen). Record/live use stratified match sampling for `--max-matches` (see Findings); **replay still uses first-N-by-id** so committed fixtures stay green until a stratified record run is committed. Fixtures are reused on cache hit (incremental). Runs print a completion summary (including live/non-cached HTTP latency and cache hit counts). Exit code `2` if every decision fell back. Snapshot suites are evaluated by default (`--no-snapshots` to skip). Use `--all-seeds` on record/live to opt into first-N-by-id.

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
Measured local `eval:record` (Gemini `gemini-3.5-flash-lite`), suite `dev`, `--max-matches 4`, 20 committed dev snapshots.

| metric | value |
| --- | --- |
| decisions | 80 (llm=80, fallback=0, skipped=0) |
| decision-validity | 100% |
| fixture_miss | 0 |
| live latency p50 / p95 (non-cached HTTP) | 733ms / 775ms |
| tokens (prompt / completion / total) | 25948 / 2276 / 28224 |
| snapshots[dev] optimal / mean regret / invalid | 100% / 0.00 / 0% |
| match outcomes | 4× draw at turn limit (20 turns) |

Reliability and tactical correctness (valid JSON moves, zero fallback, 100% snapshot-optimal on this suite) are measured. **Match-level advantage is not established**: the sampled matchup is a stalemate for random CPU, greedy CPU, and the LLM (same draw / 20 turns / 0 HP margin).
<!-- llm:end -->

## Findings

- **Sampling:** `--max-matches N` previously took the first N scenarios by id, so N=4 collapsed to one matchup (`bulwark__greedy__fracture` across unused seeds). Record/live now use stratified selection across archetype × playerPolicy × opponent. Replay still uses first-N-by-id until fixtures from a stratified record run are committed.
- **Snapshots:** committed dev snapshots are 100% optimal for both greedy and the LLM, so they do not discriminate policies. Prefer points where greedy is suboptimal (suite regeneration deferred).
- **Providers:** Cloudflare responses double-escape JSON; `mistral-small` is 429 on the free tier; `ministral-3b` wraps the payload; OpenRouter free models are shared-pool rate-limited. This run used Gemini `gemini-3.5-flash-lite`.

## Limitations

- Oracle is a fixed-policy best response, not an equilibrium.
- Snapshot suites are small (n=20 per split).
- Snapshots are drawn from **greedy-CPU play**, so they reflect states that greedy reaches (not the full state space).
- Free-tier model volatility can change live/record results.
- Replay latency is not meaningful.
- Fictional environment vocabulary only.
