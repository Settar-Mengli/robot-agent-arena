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
node scripts/run-ts.mjs src/eval/cli.ts --mode discriminate   # keyless: random vs greedy vs optimal
# Ablation (M-TOOLS) — local record; defaults --variants base,grounded, snapshots on, --max-matches 2:
npm run eval:record -- --suite heldout --variants base,grounded --snapshot-suite adversarial
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

## Does the environment discriminate?

Keyless run: `node scripts/run-ts.mjs src/eval/cli.ts --mode discriminate` (full 120-scenario suites × random / greedy / optimal; 0 inexact oracle turns).

**Verdict: DISCRIMINATES** — optimal’s CPU win-rate Wilson CI is disjoint from greedy’s on both splits, and **67.1%** of greedy-playthrough decision points have a non-zero oracle value spread (>25% threshold).

| split | policy | n | CPU win (Wilson 95%) | draw | loss | mean turns | mean HP margin |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
| dev | random | 120 | 5.00% [2.31%, 10.48%] | 9.17% | 85.83% | 17.89 | -5.32 |
| dev | greedy | 120 | 10.83% [6.44%, 17.66%] | 9.17% | 80.00% | 17.89 | -4.46 |
| dev | optimal | 120 | 83.33% [75.65%, 88.94%] | 0.00% | 16.67% | 14.68 | 8.05 |
| heldout | random | 120 | 6.67% [3.42%, 12.61%] | 0.00% | 93.33% | 18.60 | -5.09 |
| heldout | greedy | 120 | 9.17% [5.20%, 15.67%] | 11.67% | 79.17% | 18.60 | -4.69 |
| heldout | optimal | 120 | 88.33% [81.37%, 92.92%] | 0.00% | 11.67% | 17.85 | 13.97 |

Decision headroom (oracle values along greedy playthroughs):

| split | points | flat | non-zero spread | greedy suboptimal | mean / median / max spread |
| --- | ---: | ---: | ---: | ---: | --- |
| dev | 340 | 33.2% | 66.8% | 11.5% | 319.33 / 2.00 / 2007.00 |
| heldout | 381 | 32.5% | 67.5% | 10.0% | 107.27 / 2.00 / 2008.00 |

There is large room above greedy: optimal wins ~83–88% of matches while greedy wins ~9–11%. The earlier LLM↔greedy tie is therefore **not** evidence that the environment cannot separate good from bad play — only that today’s LLM mixture is not capturing that headroom.

## Ablation (M-TOOLS)

Protocol (D-024 / D-027 / D-028 / D-029):

- Arms: at least `base` (`agent-v1`) vs `grounded` (`agent-v2-grounded`). Optional: `memory`, `grounded+memory`.
- **Measurement set:** **adversarial** snapshot suites (`--snapshot-suite adversarial`), where greedy fails by construction — not standard (fixtures/CI) and not pivotal (stakes probe; greedy-saturated).
- Report per variant: snapshot optimality, mean regret, match outcomes, validity / fallbacks, per-decision audit trail, and delta vs the **adversarial** greedy/random baselines below.
- Default record caps: snapshots on, `--max-matches 2`, quota projection must stay ≤300 calls unless `--force-quota`.

### Three snapshot suites

| suite | role | selection | greedy on committed set |
| --- | --- | --- | --- |
| **standard** | fixtures / CI / keyless replay | every-kth non-flat exact points | often high (dev 100%; heldout 50%) — **no stakes** (maxRegret ≈ 1) |
| **pivotal** | high-stakes probe (D-028) | spread ≥ 100, top 20 by spread | **greedy-saturated** (dev 100% / heldout 95%) — lethal rule coincides with oracle |
| **adversarial** | ablation measurement (D-029) | greedyRegret ≥ 1, top 20 by greedyRegret | **0% by construction** |

### Why the first ablation measured nothing

A local held-out record on the **standard** snapshot suites returned **Δ0.0pp** between `base` and `grounded` (both 50% optimal / 0.50 mean regret). That is **not** evidence for or against grounding. Those suites max out at **maxRegret ≈ 1.0** — every sampled point is near-zero stakes — while discrimination shows median spread 2 and max spread ~2007, with the ~75-point greedy→optimal gap coming from rare catastrophic decisions. The standard suites sample the decisions that do not matter. That earlier Δ0.0pp stays **inconclusive**.

### Why pivotal is not the ablation set

Pivotal suites correctly select high **spread** (lethal availability), but on that set greedy already matches the oracle almost always (100% / 95%). Measuring grounding there cannot show improvement over the baseline that already saturates. Spread selects *where a mistake would hurt*; it does not select *where greedy actually errs*.

### Adversarial suite baselines (ablation comparison point)

Exact non-flat points with greedy regret ≥ 1 (any greedy error), ranked by greedyRegret (D-029 amended). Full-split scan fills target 20. `turns` retained in runtimes for memory summaries. Of the selected 20, a few remain catastrophic (regret ≥ 100); the rest are marginal errors — visible in min/median/max and the ≥100 column.

| split | regret-tail qualifies @1/100/500/1000 | selected count | greedyRegret min/median/max | # with regret ≥ 100 | greedy optimal / mean regret | random optimal / mean regret | catalog-optimal |
| --- | --- | ---: | --- | ---: | --- | --- | --- |
| dev | 39 / 3 / 3 / 3 | 20 | 2 / 2 / 2001 | 3 | **0.00%** / 301.85 | 50.00% / 150.93 | 100% / 0 |
| heldout | 38 / 1 / 1 / 1 | 20 | 2 / 5 / 2002 | 1 | **0.00%** / 104.35 | 50.00% / 52.18 | 100% / 0 |

Pivotal baselines (retained as stakes probe, not ablation):

| split | stake-tail @10/100/500/1000 | count | spread min/med/max | greedy | random |
| --- | --- | ---: | --- | --- | --- |
| dev | 54 / 54 / 54 / 54 | 20 | 2001 / 2001 / 2003 | 100.00% / 0.00 | 50.00% / 1001.00 |
| heldout | 20 / 20 / 20 / 20 | 20 | 2002 / 2007 / 2008 | 95.00% / 100.10 | 50.00% / 1002.98 |

**Command for the grounded re-run (operator, local keys required):**

```bash
npm run eval:record -- --suite heldout --variants base,grounded --snapshot-suite adversarial
```

Then paste numbers here. Do not invent results.

**Results:** _pending adversarial re-run._

**D-024 prediction:** grounded facts raise held-out **adversarial** snapshot optimality above the adversarial greedy baseline (0%) and beat greedy on match outcomes.

**D-024 falsifier:** if grounded does not beat adversarial greedy on optimality (and does not beat greedy on matches), publish that failure here.

## Findings

- **Environment discrimination:** The environment **does discriminate**. Optimal-play CPU is far above greedy on both splits (disjoint win-rate CIs); most decision points have non-zero value spread. D-025 amend: **M-ENV dropped**; batch 2 is **M-TOOLS**. First ablation on standard suites was **inconclusive**; pivotal suites are greedy-saturated (D-028); ablation measurement uses **adversarial** suites (D-029).
- **Adversarial threshold (corrected):** An earlier count of “~12 points at regret ≥ 100 in the first 12 scenarios” was wrong — the first 12 scenarios by id are nearly the same matchup with inert seeds, so that count was one state repeated. The full-split scan found only **3 dev / 1 heldout** points with greedyRegret ≥ 100 (n too small for ablation). `ADVERSARIAL_MIN_REGRET` was therefore lowered to **1** (any greedy error); both splits now commit 20 points ranked by greedyRegret, still with greedy optimalRate **0%** by construction.
- **Held-out LLM vs greedy:** On the stratified held-out sample (n=6 matchups, FRACTURE only), greedy matches the LLM on all six outcomes/turn counts and on snapshot optimality (50% / 0.50). **No measured LLM advantage** on that sample. That tie is **not** a ceiling: discrimination shows ~75 points of win-rate headroom above greedy (optimal ~83–88% vs greedy ~9–11%), so “greedy ties the LLM” means **both play poorly**, not that the task is saturated. Pre-registered grounding test remains D-024 (see Ablation section).
- **Reliability:** 84 failed provider attempts (mostly Gemini 429s) produced **zero** decision fallbacks; live latency p50 was 206ms. Per-provider attribution is in the eval summary JSON.
- **Held-out independence (fixed):** Disjoint archetypes (`aegis` / `tempest` / `mnemonic`); snapshot state-key overlap **0**.
- **Keyless replay + CI:** Fixture `manifest.json` records scenario ids per split; multi-provider keyless replay cascades across all fixture hosts. CI runs `eval:replay -- --suite all` (10 matches: 4 dev + 6 heldout).
- **Sampling:** Record/live use archetype-first stratified selection; replay follows the manifest when present.
- **Snapshots:** Dev snapshots remain 100% greedy-optimal. Held-out snapshots sit at 50% for greedy and LLM — while match-level optimal shows large headroom (see discrimination section).
- **Providers:** Cloudflare JSON double-escape; Mistral free-tier 429s / wrapping; OpenRouter free-pool limits.

## Limitations

- Oracle is a fixed-policy best response, not an equilibrium.
- Held-out LLM match sample is small (**n=6**) and all six used **FRACTURE** (archetype-first stratification varies archetype and policy before opponent, so SENTINEL-X was not sampled at n=6).
- “The LLM” in the held-out record is a **mixture of three models** via failover, not a single system under test.
- Snapshot optimality at n=20 has **no confidence interval**.
- Snapshots are drawn from **greedy-CPU play**, so they reflect states that greedy reaches (not the full state space). Seed-spread correlation remains parked (D-026). Ablation measurement uses **adversarial** suites (D-029); pivotal suites remain a stakes probe only.
- Free-tier model volatility can change live/record results.
- Replay latency is not meaningful.
- Fictional environment vocabulary only.
