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
# Bench (M-BENCH) — keyless pinned replay → committed summary (requires --models):
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite --variants base,grounded
```

`eval:replay` defaults to `--suite dev` and needs **no API keys** (placeholder provider env is derived from committed fixtures). **CI runs `npm run eval:replay -- --suite all`** (not the dev default) — held-out fixtures are committed, so `--suite heldout` / `all` work keyless. `eval:record` / live also default to `--suite dev` (pass `--suite all` or `heldout` to widen). Record/live use archetype-first stratified match sampling for `--max-matches` (see Findings). **Replay follows the fixture manifest when present** (per-variant `scenarioIds`; legacy split-level list for old readers). Fixtures are reused on cache hit (incremental). Runs print a completion summary (including live/non-cached HTTP latency and cache hit counts). Exit code `2` if every decision fell back. Snapshot suites are evaluated by default (`--no-snapshots` to skip). Use `--all-seeds` on record/live to opt into first-N-by-id. Optional `--replay-provider <name>` overrides fixture-derived provider choice. Optional `--models provider:model` pins a single provider with `maxProviders: 1` (no failover). LLM adversarial snapshot figures in this file are from a local record; reproduce keylessly with:

```bash
npm run eval:replay -- --suite heldout --variants base,grounded --snapshot-suite adversarial
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
| 20 | 50.00% | 351.2250 | 2007.0000 |

#### Snapshots — greedy

| n | optimal rate | mean regret | max regret |
| ---: | ---: | ---: | ---: |
| 20 | 85.00% | 100.2500 | 2001.0000 |

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
| 20 | 50.00% | 51.3500 | 2007.0000 |

#### Snapshots — greedy

| n | optimal rate | mean regret | max regret |
| ---: | ---: | ---: | ---: |
| 20 | 80.00% | 0.2500 | 2.0000 |

<!-- baseline:end -->

## LLM results

> **D-035:** Adversarial LLM snapshot rows below are **historical** (pre-dedupe n=20). After suite regen (heldout adversarial **n=13** distinct states), keyless replay/bench hit `fixture_miss` on new states — **pending operator re-record**. Match-table / standard-snapshot rows in the llm block remain the earlier stratified sample (unchanged measurement).

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
| snapshots[heldout, **standard**] optimal / mean regret / invalid | 50% / 0.50 / 0% |

#### Provider attempts (failover)

| provider | ok | fail |
| --- | ---: | --- |
| gemini | 62 | 429×78 |
| openrouter | 32 | (no status)×6 |
| groq | 6 | 0 |

**84 failed attempts produced zero fallbacks** — failover absorbed every miss.

#### Matches — random vs greedy vs LLM (same 6 scenarios)

Independently verified: greedy CPU matches the LLM on **every** row (result and turn count). Random differs only on `aegis__greedy` (player-victory instead of draw). Held-out **standard** snapshot optimality: greedy 50% / 0.50 regret (identical to LLM); random 50% / 0.75.

| scenario | random | greedy | LLM |
| --- | --- | --- | --- |
| aegis__greedy__fracture__s101 | player-victory / 20t | draw / 20t | draw / 20t |
| mnemonic__greedy__fracture__s101 | player-victory / 20t | player-victory / 20t | player-victory / 20t |
| tempest__greedy__fracture__s101 | player-victory / 11t | player-victory / 11t | player-victory / 11t |
| aegis__seeded-random__fracture__s101 | cpu-victory / 20t | cpu-victory / 20t | cpu-victory / 20t |
| mnemonic__seeded-random__fracture__s101 | player-victory / 20t | player-victory / 20t | player-victory / 20t |
| tempest__seeded-random__fracture__s101 | player-victory / 11t | player-victory / 11t | player-victory / 11t |

**Headline (scoped):** On this sample — **n=6 matchups, FRACTURE only, standard snapshots** — the deterministic greedy bot is indistinguishable from the LLM on both tactical optimality (standard held-out snapshots) and match outcomes across these six matchups. That is **not** the current measurement set. Held-out **adversarial** LLM figures after D-035 suite regen are **pending operator re-record** (see [Ablation](#ablation-m-tools)); greedy baseline on the new suite is **0% / mean regret 156.15** (n=13 distinct).
<!-- llm:end -->

## Does the environment discriminate?

Keyless run: `node scripts/run-ts.mjs src/eval/cli.ts --mode discriminate` (full 120-scenario suites × random / greedy / optimal; 0 inexact oracle turns).

> **D-035 note:** Match n=120 and headroom point counts below still treat seed clones as separate trials until commit 3 (distinct-battle / distinct-state denominators). Discrimination **direction** (optimal ≫ greedy) is unchanged.

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

Protocol (D-024 / D-027 / D-028 / D-029 / D-035):

- Arms: at least `base` (`agent-v1`) vs `grounded` (`agent-v2-grounded`). Optional: `memory`, `grounded+memory`.
- **Measurement set:** **adversarial** snapshot suites (`--snapshot-suite adversarial`), where greedy fails by construction — not standard (fixtures/CI) and not pivotal (stakes probe; greedy-saturated).
- Report per variant: snapshot optimality, mean regret, match outcomes, validity / fallbacks, per-decision audit trail, and delta vs the **adversarial** greedy/random baselines below.
- Default record caps: snapshots on, `--max-matches 2`, quota projection must stay ≤300 calls unless `--force-quota`.

### Three snapshot suites

| suite | role | selection | greedy on committed set |
| --- | --- | --- | --- |
| **standard** | fixtures / CI / keyless replay | every-kth non-flat exact points, **distinct states** (D-035) | dev 85% / 100.25; heldout 80% / 0.25 (n=20 distinct) |
| **pivotal** | high-stakes probe (D-028) | spread ≥ 100, top by spread, distinct states | shortfall **n=8** both splits; greedy **87.5%** / ~250 mean regret |
| **adversarial** | ablation measurement (D-029) | greedyRegret ≥ 1, top by greedyRegret, distinct states | **0% by construction**; dev **n=6** / mean 335.17; heldout **n=13** / mean 156.15 |

### Why the first ablation measured nothing

A local held-out record on the **standard** snapshot suites returned **Δ0.0pp** between `base` and `grounded` (both 50% optimal / 0.50 mean regret). That is **not** evidence for or against grounding. Those suites max out at **maxRegret ≈ 1.0** — every sampled point is near-zero stakes — while discrimination shows median spread 2 and max spread ~2007, with the ~75-point greedy→optimal gap coming from rare catastrophic decisions. The standard suites sample the decisions that do not matter. That earlier Δ0.0pp stays **inconclusive**.

### Why pivotal is not the ablation set

Pivotal suites correctly select high **spread** (lethal availability). After D-035 distinct-state regen they shortfall at **n=8** with greedy still mostly oracle-aligned (**87.5%**). Measuring grounding there remains a weak ablation set versus adversarial (where greedy is **0%** by construction).

### Adversarial suite baselines (ablation comparison point)

Exact non-flat points with greedy regret ≥ 1, ranked by greedyRegret, **deduped by decision state** (D-035). Target 20; honest shortfall when the split cannot supply enough distinct states. Tail qualifies count **distinct** states meeting each threshold.

| split | regret-tail qualifies @1/100/500/1000 (distinct) | selected / target | greedyRegret min/median/max | # with regret ≥ 100 | greedy optimal / mean regret | random optimal / mean regret | catalog-optimal |
| --- | --- | ---: | --- | ---: | --- | --- | --- |
| dev | 13 / 1 / 1 / 1 | **6** / 20 | 2 / 2 / 2001 | 1 | **0.00%** / 335.17 | 50.00% / 167.58 | 100% / 0 |
| heldout | 13 / 1 / 1 / 1 | **13** / 20 | 1 / 2 / 2002 | 1 | **0.00%** / 156.15 | 50.00% / 78.08 | 100% / 0 |

Pivotal baselines (retained as stakes probe, not ablation):

| split | stake-tail @10/100/500/1000 (distinct) | selected / target | spread min/med/max | greedy | random |
| --- | --- | ---: | --- | --- | --- |
| dev | 8 / 8 / 8 / 8 | **8** / 20 | 2001 / 2003 / 2007 | 87.50% / 250.13 | 50.00% / 1001.81 |
| heldout | 8 / 8 / 8 / 8 | **8** / 20 | 2002 / 2005 / 2008 | 87.50% / 250.25 | 50.00% / 1002.63 |

**Operator re-record (keys required) after D-035 suite regen:**

```bash
npm run eval:record -- --suite heldout --variants base,grounded,grounded-v2 --snapshot-suite adversarial --max-matches 2
```

Quota projection: `models=1 variants=3 snapshots=13 matches=2 × ~17 × consistency=1 → 141 calls (cap 300)`.

### Results (held-out adversarial, historical n=20 pre-D-035) — D-024 FALSIFIED

> Historical row on the **pre-dedupe** suite (multiplicity-weighted). D-030 agreement claim (grounding changed **0** decisions) survives; do not re-cite the old greedy mean regret **104.35** as the current baseline — current greedy baseline is **0% / 156.15** (n=13). LLM optimality on the **new** suite is **pending operator re-record**.

| arm | promptVersion | optimal | mean / median / max regret | regret≥100 | validity | fallback |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| **base** (historical) | agent-v1 | 5.00% | 4.25 / 5.00 / 5.00 | 0 | 100% | 0 |
| **grounded** (historical) | agent-v2-grounded | 5.00% | 4.25 / 5.00 / 5.00 | 0 | 100% | 0 |

- Grounding changed **zero of 20** decisions on that historical suite (per-decision audit: identical picks). Prompt-version guard confirms facts were present (`agent-v2-grounded` vs `agent-v1`).
- **D-024’s prediction is FALSIFIED** as stated: grounded facts did not raise optimality above the adversarial greedy baseline in a way that differs from base.

**Historical comparison vs then-suite baselines** (kept for the falsification record; not the current D-035 baselines):

| vs | Δoptimal | Δregret (mean) |
| --- | ---: | ---: |
| greedy (historical 0% / mean 104.35) | **+5.0pp** | **−100.10** |
| random (historical 50% / mean 52.18) | −45.0pp | −47.93 |

**Opposite failure modes (historical finding):** On that suite greedy was **0%** optimal with **mean regret 104.35** while the LLM was **5%** / **4.25**. **Optimality rate alone is the wrong single metric** when stakes are skewed (D-031).

Providers across the record run: gemini 71 decisions (18× 429), openrouter 8 (2× 429), groq 1 — zero fallbacks.

**D-024 prediction (historical):** grounded facts raise held-out adversarial snapshot optimality above the adversarial greedy baseline (0%) and beat greedy on match outcomes.

**D-024 falsifier (applied):** grounded did not change any decision vs base on the measurement set; publish that failure here.

### Corrected grounding arm (D-034) — RESULTS PENDING OPERATOR RECORD

Historical `grounded` (`agent-v2-grounded`) remains the D-024/D-030 record and must not be rewritten. The corrected arm is a **new** variant:

| | |
| --- | --- |
| variant | `grounded-v2` |
| promptVersion | `agent-v4-grounded` |
| play option | `facts-v2` |
| fixes | post-action `diesNextTurnAfterMove`; fallback-stabilize projection when unaffordable; unmodelled categories refused in V2 facts |

**Prediction (pre-registered):** corrected arm changes **≥1** decision vs `base` on held-out adversarial and does **not** increase mean regret.

**Operator command (keys required) — use post-D-035 suite (n=13):**

```powershell
npm run eval:record -- --suite heldout --variants base,grounded-v2 --snapshot-suite adversarial --max-matches 2
```

CLI quota projection:  
`quota projection: models=1 variants=2 snapshots=13 matches=2 × ~17 × consistency=1 → 94 calls (cap 300)`

### Results (held-out adversarial, n=13 distinct) — D-034 — PENDING

| arm | promptVersion | optimal | mean / median / max regret | regret≥100 | validity | fallback | decisions changed vs base |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
| **base** | agent-v1 | — | — | — | — | — | — |
| **grounded-v2** | agent-v4-grounded | — | — | — | — | — | — |

Fill after the operator record; do not invent numbers.

## Bench (M-BENCH)

Pinned single-model comparison on the **adversarial** measurement set (D-032). Columns exist so model choice is an evidence question, not folklore:

| column | why |
| --- | --- |
| optimal rate + regret distribution | D-031: rate alone hides stakes-skewed failure modes |
| validity / fallback taxonomy | separates bad JSON from provider outages |
| latency p50/p95/p99 | live only; null under keyless replay |
| cost USD | from `evals/pricing.json`; **null when unpriced** (never invent) |
| self-consistency | `--consistency N` + repeat-aware fixture keys |
| prompt version | `base` vs `grounded` is an axis, not a hidden constant |

**Protocol:** `--models provider:model` sets `INFERENCE_PROVIDER_ORDER` + `INFERENCE_MAX_PROVIDERS=1` (no failover). Defaults: `--suite heldout`, `--snapshot-suite adversarial`, `--max-matches 0` (snapshots only), `--variants base,grounded`, T=0, consistency 1. Adversarial greedy/random baselines: `evals/out-committed/adversarial.baselines.json` (post-D-035: heldout greedy **0% / 156.15**, n=13).

### Single-model table (committed summary) — PENDING

From `evals/out-committed/bench.summary.json`: **`rows: []`**, `singleModelPending: true`. Keyless gemini replay after D-035 suite regen hit `fixture_miss` on new snapshot keys — stale 5%/4.25 row **removed** (not invented).

**Operator record then keyless bench:**

```bash
npm run eval:record -- --suite heldout --variants base,grounded --snapshot-suite adversarial --max-matches 0 --models gemini:gemini-3.5-flash-lite
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite --variants base,grounded
```

Quota: `1 × 2 × 13 × 1 = 26` calls (well under 300).

### Operator multi-model command

```bash
# Local record (keys required), then keyless bench:
npm run eval:record -- --suite heldout --variants base,grounded --snapshot-suite adversarial --max-matches 0 --models groq:MODEL,gemini:gemini-3.5-flash-lite,mistral:MODEL
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models groq:MODEL,gemini:gemini-3.5-flash-lite,mistral:MODEL --variants base,grounded
```

Replace `MODEL` with the free-tier ids you record. Quota: `models × variants × (snapshots + matches×17) × consistency` — refuse >300 without `--force-quota` (e.g. 3×2×13 = 78 at consistency 1).

## Findings

- **Direction (D-033):** Product output reframes from scoring to **diagnosis** against exact ground truth. The three new measurements (prompt-perturbation sensitivity, adversarial-context robustness, information-scaling curves) will be **pre-registered before implementation** (same pattern as D-024). Binding honesty and known limitations are recorded in D-033.
- **Environment discrimination:** The environment **does discriminate**. Optimal-play CPU is far above greedy on both splits (disjoint win-rate CIs); most decision points have non-zero value spread. D-025 amend: **M-ENV dropped**; batch 2 is **M-TOOLS**. First ablation on standard suites was **inconclusive**; pivotal suites shortfall after D-035 (n=8, greedy 87.5%); adversarial ablation **measured** (D-030): grounding changed 0 decisions on the historical suite — D-024 **falsified**.
- **D-035 distinct states:** Generators and drift guards assert `distinctStateCount === snapshots.length`. Held-out adversarial **n=13** (was 20 with only 6 distinct); greedy mean regret **156.15** (was multiplicity-weighted **104.35**). LLM/bench rows on the new suite are **pending** operator record.
- **Adversarial threshold (corrected):** An earlier count of “~12 points at regret ≥ 100 in the first 12 scenarios” was wrong — inert seeds. `ADVERSARIAL_MIN_REGRET=1`; after D-035 distinct-state counting, regret-tail @1 is **13** distinct per split; selected suites shortfall below target 20 where needed.
- **Metric choice (D-031):** On stakes-skewed adversarial sets, report regret distribution alongside rate (historical opposite failure modes on the pre-dedupe suite).
- **Held-out LLM vs greedy (earlier standard-suite sample):** On the stratified held-out sample (n=6 matchups, FRACTURE only), greedy matched the LLM on outcomes. That sample is **not** the adversarial measurement set.
- **Reliability:** 84 failed provider attempts (mostly Gemini 429s) produced **zero** decision fallbacks; live latency p50 was 206ms. Per-provider attribution is in the eval summary JSON.
- **Held-out independence (fixed):** Disjoint archetypes (`aegis` / `tempest` / `mnemonic`); snapshot state-key overlap **0**.
- **Keyless replay + CI:** Fixture `manifest.json` records scenario ids per split; multi-provider keyless replay cascades across all fixture hosts. CI runs `eval:replay -- --suite all` (10 matches: 4 dev + 6 heldout).
- **Sampling:** Record/live use archetype-first stratified selection; **replay follows the manifest when present** (first-N-by-id only if the manifest is missing).
- **Reproduce logs:** Aggregate discrimination numbers live in `evals/out-committed/discriminate.summary.json`. Adversarial greedy/random baselines: `evals/out-committed/adversarial.baselines.json`.
- **Snapshots:** Standard suites n=20 distinct (dev greedy 85% / heldout 80%). Held-out **adversarial** greedy is **0%** by construction (n=13).
- **Providers:** Cloudflare JSON double-escape; Mistral free-tier 429s / wrapping; OpenRouter free-pool limits.

## Limitations

- Oracle is a fixed-policy best response, not an equilibrium.
- **M-TOOLS adversarial ablation:** Historical n=20 (pre-D-035 duplicates); current suite n=13 distinct — LLM rows pending re-record; matches were only 2 and unchanged between variants on the historical run; decisions came from three models via failover; no confidence intervals at this n; this says nothing about grounding in a richer environment. Memory variants (`agent-v2-memory`, `agent-v3-grounded-memory`) remain **unmeasured**.
- Held-out LLM match sample on the earlier record is small (**n=6**) and all six used **FRACTURE**.
- Snapshot optimality at current suite sizes has **no confidence interval** (heldout adversarial n=13 distinct).
- Snapshots are drawn from **greedy-CPU play**, so they reflect states that greedy reaches (not the full state space). Seed-spread correlation is a known limitation (D-026 closed won't-fix under D-033).
- Free-tier model volatility can change live/record results.
- Replay latency is not meaningful.
- Fictional environment vocabulary only.
