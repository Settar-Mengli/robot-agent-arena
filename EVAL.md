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

### Evidence+Ship (ES) — record then bench

**Order:** run all `eval:record` first (operator, local keys). Only after fixtures exist, run `--mode bench` (keyless replay; never live).

- Additive suite: `--snapshot-suite adversarial-heldout-ext` (D-044; honest n after widen-once seeds 201–280).
- Second pin: `groq:openai/gpt-oss-20b` beside `gemini:gemini-3.5-flash-lite` (D-046).
- Free-text variant: `--variants freetext` (code shipped phase 1; fixtures quota-gated / D-047).
- Live profile: written under `evals/out/bench.live-profile.json` from **live recording calls only** (cache hits excluded).

### Batch 3 (D-049) — Arena + diagnostics

```bash
npm run arena:pack    # gemini heldout Watch catalog → src/ui/arena/pack/arena-replay.v1.json
npm run lab:pack      # Decision Lab pack v3 + diagnostics.summary.json (committed)
```

Lab pack note: decision-lab.v3.json was frozen at Batch 3; Batch 4 extended evals/fixtures/manifest.json without regenerating the pack, so inputHashes.fixtureManifest differs on regen by design (see decision-lab-pack.test.ts). Users are unaffected; the committed pack is the evidence.

Watch mode replays recorded gemini matches only (not live AI). Free play remains greedy. Diagnostics failure tags are descriptive labels on suboptimal decisions — not causal. Lab Challenge scores from pack oracle values only.

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
| all | 44 | 9.09% [3.59%, 21.16%] | 2.27% | 88.64% | 18.84 | -4.77 |
| cpu-fracture | 15 | 20.00% [7.05%, 45.19%] | 6.67% | 73.33% | 16.60 | -4.00 |
| cpu-sentinel-x | 30 | 3.33% [0.59%, 16.67%] | 0.00% | 96.67% | 20.00 | -5.10 |

#### Matches — greedy CPU

| slice | n | CPU win (Wilson 95%) | draw | loss | mean turns | mean HP margin (CPU−player) |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| all | 41 | 17.07% [8.53%, 31.26%] | 2.44% | 80.49% | 18.76 | -3.54 |
| cpu-fracture | 15 | 20.00% [7.05%, 45.19%] | 6.67% | 73.33% | 16.60 | -4.00 |
| cpu-sentinel-x | 26 | 15.38% [6.15%, 33.53%] | 0.00% | 84.62% | 20.00 | -3.27 |

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
| all | 56 | 14.29% [7.42%, 25.74%] | 0.00% | 85.71% | 19.57 | -3.23 |
| cpu-fracture | 23 | 30.43% [15.60%, 50.87%] | 0.00% | 69.57% | 18.96 | -3.57 |
| cpu-sentinel-x | 33 | 3.03% [0.54%, 15.32%] | 0.00% | 96.97% | 20.00 | -3.00 |

#### Matches — greedy CPU

| slice | n | CPU win (Wilson 95%) | draw | loss | mean turns | mean HP margin (CPU−player) |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| all | 53 | 20.75% [12.00%, 33.46%] | 1.89% | 77.36% | 19.55 | -2.87 |
| cpu-fracture | 21 | 28.57% [13.81%, 49.96%] | 4.76% | 66.67% | 18.86 | -2.95 |
| cpu-sentinel-x | 33 | 15.15% [6.65%, 30.92%] | 0.00% | 84.85% | 20.00 | -2.79 |

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

Keyless run: `node scripts/run-ts.mjs src/eval/cli.ts --mode discriminate` (full 120-scenario suites × random / greedy / optimal; 0 inexact oracle turns). Match aggregates and Wilson intervals use **distinct battle fingerprints** (D-035); headroom counts **distinct decision states** (first visit wins).

**Verdict: DISCRIMINATES** — optimal’s CPU win-rate Wilson CI is disjoint from greedy’s on both splits, and **70.2%** of distinct greedy-playthrough decision points have a non-zero oracle value spread (>25% threshold).

| split | policy | n (distinct battles) | CPU win (Wilson 95%) | draw | loss | mean turns | mean HP margin |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| dev | random | 44 | 9.09% [3.59%, 21.16%] | 2.27% | 88.64% | 18.84 | -4.77 |
| dev | greedy | 41 | 17.07% [8.53%, 31.26%] | 2.44% | 80.49% | 18.76 | -3.54 |
| dev | optimal | 42 | 78.57% [64.06%, 88.29%] | 0.00% | 21.43% | 14.83 | 8.83 |
| heldout | random | 56 | 14.29% [7.42%, 25.74%] | 0.00% | 85.71% | 19.57 | -3.23 |
| heldout | greedy | 53 | 20.75% [12.00%, 33.46%] | 1.89% | 77.36% | 19.55 | -2.87 |
| heldout | optimal | 65 | 93.85% [85.22%, 97.58%] | 0.00% | 6.15% | 17.25 | 15.34 |

Decision headroom (oracle values along greedy playthroughs; distinct states):

| split | points | flat | non-zero spread | greedy suboptimal | mean / median / max spread |
| --- | ---: | ---: | ---: | ---: | --- |
| dev | 40 | 32.5% | 67.5% | 5.0% | 351.85 / 2.00 / 2007.00 |
| heldout | 91 | 28.6% | 71.4% | 9.9% | 134.36 / 2.00 / 2007.00 |

There is large room above greedy: optimal wins ~79–94% of distinct battles while greedy wins ~17–21%. The earlier LLM↔greedy tie is therefore **not** evidence that the environment cannot separate good from bad play — only that today’s LLM mixture is not capturing that headroom.

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

> Historical row on the **pre-dedupe** suite (multiplicity-weighted). D-030 agreement claim (grounding changed **0** decisions) survives; do not re-cite the old greedy mean regret **104.35** as the current baseline — current greedy baseline is **0% / 156.15** (n=13). LLM optimality on the **new** suite is published in the pinned ablation below (D-034 / D-036).

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

### Corrected grounding arm (D-034) — pinned result

Historical `grounded` (`agent-v2-grounded`) remains the D-024/D-030 record and must not be rewritten. The corrected arm is a **new** variant:

| | |
| --- | --- |
| variant | `grounded-v2` |
| promptVersion | `agent-v4-grounded` |
| play option | `facts-v2` |
| fixes | post-action `diesNextTurnAfterMove`; fallback-stabilize projection when unaffordable; unmodelled categories refused in V2 facts |

**Prediction (pre-registered):** corrected arm changes **≥1** decision vs `base` on held-out adversarial and does **not** increase mean regret. Testable only under a pinned model (D-036).

### Measured instability (unpinned multi-variant runs — not a published result)

Two consecutive local `eval:record` runs with identical arguments, prompts, and temperature 0, **without** `--models`, produced contradictory **base** figures on **dev:adversarial** (n=6):

| run | base optimal | base mean regret | what differed |
| --- | ---: | ---: | --- |
| 1 | **50.00%** | **1.00** | provider mixture under failover |
| 2 | **33.33%** | **334.50** | same code/prompt; different providers answered (e.g. gemini ~209 decisions with ~58 rate-limit failures, plus groq/openrouter) |

Fixture keys include host and model, so the same decision stores different answers per provider; replay reproduces whichever was recorded. **Any base-vs-variant comparison from these unpinned runs is confounded by provider assignment.** Unpinned multi-variant recordings were **not committed** (D-036).

### Results — D-034 — pinned `gemini/gemini-3.5-flash-lite` (attributable, D-036)

Keyless `eval:replay -- --suite all` after the pinned record. Measurement is **adversarial snapshots only**; match scenarioIds in the manifest were trimmed to completely recorded scenarios (incomplete matches dropped — not part of this claim).

| arm | promptVersion | split | n | optimal | mean / median / max regret | regret≥100 | decisions changed vs base |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: |
| **base** | agent-v1 | dev | 6 | 33.33% | 334.50 / 2.00 / 2001.00 | 1 | — |
| **grounded** | agent-v2-grounded | dev | 6 | 33.33% | 334.50 / 2.00 / 2001.00 | 1 | **0** |
| **grounded-v2** | agent-v4-grounded | dev | 6 | 33.33% | 334.50 / 2.00 / 2001.00 | 1 | **0** |
| **base** | agent-v1 | heldout | 13 | 15.38% | 2.00 / 2.00 / 5.00 | 0 | — |
| **grounded** | agent-v2-grounded | heldout | 13 | 7.69% | 2.15 / 2.00 / 5.00 | 0 | **1** |
| **grounded-v2** | agent-v4-grounded | heldout | 13 | 7.69% | 2.15 / 2.00 / 5.00 | 0 | **1** |

`grounded` and `grounded-v2` are **identical** on both splits (0 decision diffs between them). On held-out, both differ from `base` on exactly **one** snapshot (`tempest__seeded-random__sentinel-x__s109__t3`: base `skill-null-pulse` → grounded/v2 `skill-logic-storm`).

**Conclusion (this model, this suite only):** the ≥1 decision-change half of the D-034 prediction is **met** on held-out; the “mean regret does not increase” half is **falsified** (2.00 → 2.15). Corrected grounding shows **no measured improvement** over base here — one decision changes, mean regret rises slightly. No confidence interval at n=6 / n=13; one free-tier model only.

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

### Multi-model table (committed summary)

From `evals/out-committed/bench.summary.json` (`singleModelPending: false`; **base/grounded only** — 8 rows). Freetext n=13 is published in the table below and in the Lab pack (D-047), not in the committed summary file. Keyless replay of recorded fixtures; latency null under replay. Live token totals: `evals/out-committed/bench.live-profile.json` (label `live`, 2026-09-21…2026-09-22; latency unavailable — per-run live latencies were overwritten and are not reconstructed).

**Heldout adversarial (n=13)** — all rows **insufficient evidence** (n&lt;30):

| model | variant | optimal | Wilson 95% | mean regret |
| --- | --- | ---: | --- | ---: |
| gemini:gemini-3.5-flash-lite | base | **15.4%** | [4.3%, 42.2%] | 2.00 |
| gemini:gemini-3.5-flash-lite | grounded | **7.7%** | [1.4%, 33.3%] | 2.15 |
| gemini:gemini-3.5-flash-lite | freetext | **15.4%** | [4.3%, 42.2%] | 2.00 |
| groq:openai/gpt-oss-20b | base | **7.7%** | [1.4%, 33.3%] | 2.15 |
| groq:openai/gpt-oss-20b | grounded | **15.4%** | [4.3%, 42.2%] | 2.00 |
| groq:openai/gpt-oss-20b | freetext | **15.4%** | [4.3%, 42.2%] | 2.00 |

**Heldout-ext (n=35, D-044)** — Wilson width &lt;0.40 and n≥30 (not labeled insufficient):

| model | variant | optimal | Wilson 95% | mean regret |
| --- | --- | ---: | --- | ---: |
| gemini:gemini-3.5-flash-lite | base | **34.3%** | [20.8%, 50.8%] | 1.23 |
| gemini:gemini-3.5-flash-lite | grounded | **34.3%** | [20.8%, 50.8%] | 1.23 |
| groq:openai/gpt-oss-20b | base | **37.1%** | [23.2%, 53.7%] | 1.20 |
| groq:openai/gpt-oss-20b | grounded | **37.1%** | [23.2%, 53.7%] | 1.06 |

Note: gemini base and grounded on heldout-ext are **genuinely identical choices** (35/35 same `skillId`) with distinct prompt versions (`agent-v1` vs `agent-v2-grounded`) — not a fixture-key collision. Free-text not recorded on ext (D-047).

Reproduce keylessly:

```bash
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite,groq:openai/gpt-oss-20b --variants base,grounded --snapshot-suite adversarial,adversarial-heldout-ext --max-matches 0
node scripts/run-ts.mjs src/eval/cli.ts --mode replay --suite heldout --variants freetext --snapshot-suite adversarial --max-matches 0 --models gemini:gemini-3.5-flash-lite
```

### Operator multi-model command

```bash
# Local record (keys required), then keyless bench
npm run eval:record -- --suite heldout --variants base,grounded --snapshot-suite adversarial --max-matches 0 --models groq:openai/gpt-oss-20b
node scripts/run-ts.mjs src/eval/cli.ts --mode bench --models gemini:gemini-3.5-flash-lite,groq:openai/gpt-oss-20b --variants base,grounded --snapshot-suite adversarial,adversarial-heldout-ext --max-matches 0
```

Quota: `models × variants × (snapshots + matches×17) × consistency` — refuse >300 without `--force-quota`.

## Findings

- **Direction (D-033):** Product output reframes from scoring to **diagnosis** against exact ground truth. Batch 4 / **D-051 executed** the preregistered robustness arms (perturbation, adversarial context, partial facts / scaling slice) on heldout-ext n=35; **memory variants and the full information-scaling curve remain deferred** (D-055). Binding honesty and known limitations are recorded in D-033 / D-055.
- **Environment discrimination:** The environment **does discriminate**. Optimal-play CPU is far above greedy on both splits (disjoint win-rate CIs over **distinct battles**); ~70% of distinct decision points have non-zero value spread. D-025 amend: **M-ENV dropped**; batch 2 is **M-TOOLS**. First ablation on standard suites was **inconclusive**; pivotal suites shortfall after D-035 (n=8, greedy 87.5%); adversarial ablation **measured** (D-030): grounding changed **0** decisions on the **historical pre–D-035 duplicate-state suite** (the published **0/20** figure is **narrative-only** — not the committed distinct-state count). D-024 **falsified** on that historical narrative; the **committed** held-out adversarial measurement set is **n=13** distinct states (D-035).
- **D-035 distinct states:** Generators and drift guards assert `distinctStateCount === snapshots.length`. Held-out adversarial **n=13** (was 20 with only 6 distinct); greedy mean regret **156.15** (was multiplicity-weighted **104.35**). Pinned gemini LLM/bench rows published (D-034 / D-036).
- **Pinning (D-036):** A pin is required for multi-variant comparative output and comes from either `--models provider:model` or a unanimous recorded manifest pin. Record and live hard-fail without a resolved pin. Legacy unpinned multi-variant replay still runs but **withholds** comparative deltas (per-variant results print labelled not comparable). Unpinned failover mixes providers across runs; two unpinned base/dev:adversarial runs moved from 50%/1.00 to 33.33%/334.50 with no code change. Gameplay failover in `src/inference` is unchanged.
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
- **M-TOOLS adversarial ablation:** Pinned gemini on post-D-035 suites (heldout n=13): grounded and grounded-v2 each change **1** decision vs base and raise mean regret 2.00→2.15; the two grounded arms are identical. No confidence intervals at this n; one model only; matches trimmed from the manifest (not part of the measurement). Memory variants remain **unmeasured**.
- Held-out LLM match sample on the earlier record is small (**n=6**) and all six used **FRACTURE**.
- Snapshot optimality at current suite sizes has **no confidence interval** (heldout adversarial n=13 distinct).
- Snapshots are drawn from **greedy-CPU play**, so they reflect states that greedy reaches (not the full state space). Seed-spread correlation is a known limitation (D-026 closed won't-fix under D-033).
- Free-tier model volatility can change live/record results.
- Replay latency is not meaningful.
- Fictional environment vocabulary only.

## Batch 4 / D-051 — Robustness (heldout-ext n=35)

Pre-registration: `docs/preregistration-batch4.md` (SHA `2a130a7…`; amendments `48fa3d2`, `6b08ebb`). Summary: `evals/out-committed/batch4.robustness.summary.json`.

**Outcome (null result, scoped):** Rewording + option-order/format (perturb), a fixed arena rumor (advctx), and partial grounded facts (info-partial) did **not** produce separable Δregret effects vs base on either pin. Gemini: **0/35** flips on all new arms vs base. Groq: **1/35** flips on each of the four vs base (same snapshot); that single flip also appears on base-repeat (noise). Gemini C expected-degenerate. Window 3 not recorded.

| id | mean Δregret | 95% CI | separable | notes |
| --- | ---: | --- | --- | --- |
| gemini/A-delta | 0 | [0, 0] | no | flip=0; not separable from noise |
| gemini/A-noise-delta | 0 | [0, 0] | no (noise baseline) | |
| gemini/B-delta | 0 | [0, 0] | no | |
| gemini/C-vs-base | 0 | [0, 0] | no | expectedDegenerate |
| gemini/C-vs-grounded | 0 | [0, 0] | no | expectedDegenerate |
| gemini/A-flip-perturb | — | flip rate 0 | no | |
| gemini/A-flip-noise | — | flip rate 0 | no | |
| groq/A-delta | 0.0286 | [0, 0.0857] | no | flip=1/35; not separable from noise |
| groq/A-noise-delta | 0.0286 | [0, 0.0857] | no (noise baseline) | |
| groq/B-delta | 0.0286 | [0, 0.0857] | no | |
| groq/C-vs-base | 0.0286 | [0, 0.0857] | no | |
| groq/C-vs-grounded | 0.1714 | [0, 0.5143] | no | |
| groq/A-flip-perturb | — | flip rate 1/35 | no | not separable from run-to-run noise; same 1 snap as noise |
| groq/A-flip-noise | — | flip rate 1/35 | no (noise baseline) | |

**Limitations:** two-move loadouts; T=0; single suite; no multiplicity correction; A combined surfaces; gemini C degenerate; Window 3 cut. Groq's base answers were recorded in Batch 2; the new versions were recorded later. The 1 of 35 difference may reflect changes on the provider's side over time, not only same-session wobble.

## Batch 5 / D-052 — Resonance Seal (second reference environment)

Keyless headless baselines only. Suite: `evals/env-suites/resonance-seal/snapshots.resonance-seal.v1.json` (n=40 informative states; all-ties excluded). Summary: `evals/out-committed/resonance-seal.baselines.v1.json`.

**Scale honesty:** Seal regret scale ≠ robot battle. **Never compare metrics across environments.** Seal is **not** on the leaderboard. Oracle = exact best response to a fixed vault pressure script (not an equilibrium).

**Shared (generality proof):** `EnvironmentOf`, `evaluateChoices`, `aggregateChoiceMetrics`, `wilsonInterval` / `bootstrapMeanCi` / `insufficientEvidence`. Robot production `Environment` / `robotEnvironment` unchanged; adapter + golden test prove shared eval.

**Not shared:** LLM prompt/agent path; cross-env comparison.

**Committed greedy / random (n=40):** plan greedy optimalRate **0.90**, meanRegret **0.10** (greedy≠oracle **0.10**, measured); random optimalRate **0.55**, meanRegret **16.325** (random≠oracle **0.45**). See summary JSON for Wilson / bootstrap CIs, oracle-best distribution, spreads, and excluded-all-tie count.
