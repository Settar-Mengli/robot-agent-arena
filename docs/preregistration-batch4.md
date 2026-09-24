# Pre-registration — Batch 4 robustness (D-051)

Status: pre-registered before any Batch 4 recording.
Commit: 2a130a757543433fbec9d56a1ead9fd59d07d114 (Phase 1 push; this file first landed in that commit)
No outcome-dependent changes after recording; deviations logged as deviations.

## Shared protocol
- Primary suite: adversarial-heldout-ext, n=35 (n≥30 evidence gate).
- Secondary: adversarial n=13 (always insufficient-evidence); optional; cut first.
- Pins: gemini:gemini-3.5-flash-lite; groq:openai/gpt-oss-20b.
- Recorder: temperature 0 (src/eval/cli.ts); no top_p in request body.
- Consistency: 1.
- Baseline fixtures: existing committed base/grounded (not re-recorded).
- New recorded variants: base-repeat, perturb, advctx, info-partial.
- Primary calls: 2×4×35=280 ≤ 300.
- Primary metric for decisions: seeded paired bootstrap 95% CI of mean Δregret
  (variant − baseline, matched snapshot ids).
  Implementation: bootstrapMeanCi on per-case deltas;
  seed=0xA11CE, B=2000, alpha=0.05 (src/decision-lab/stats.ts defaults — locked).
- Wilson 95% on optimal rate: display only; not the decision criterion.
- Family: confirmatory. All listed comparisons reported. No multiplicity correction
  (limitation: family-wise error not controlled).
- Null / not separable: CI does not lie entirely on the registered side of 0
  (for two-sided A: CI contains 0), OR (A only) flip-rate not separable from noise.
- Insufficient-evidence: n<30 or Wilson width gate per existing helper; always on n=13.

## Experiment A — Prompt perturbation (combined surface sensitivity)
Hypothesis: Semantically equivalent surface changes change decisions beyond run-to-run noise.
Manipulation (applied together — combined, not factorial): (1) rewording of instructions,
(2) option-order shuffle, (3) formatting (whitespace/bullets/JSON key order where safe).
Confound statement: A measures combined surface sensitivity; it does not attribute which
surface change matters.
Option-order algorithm: Fisher–Yates on equipped skill list; RNG = mulberry32(seed);
seed = (FNV-1a-32 of snapshotId) XOR 0xA0B4C4D5 (fixed). Deterministic per snapshot id.
Variant: perturb / agent-v6-perturb-*.
Noise arm: base-repeat / agent-v6-base-repeat — prompt message bytes ≡ base; fixture key
forced via setRepeat(1) because fixtureKey ignores promptVersion.
n: 35 primary; models: both pins.
Comparisons (report all):
- A-Δ: mean Δregret (perturb − base), registeredDirection=two-sided. Separable iff CI
  excludes 0 AND separableFromNoise.
- A-noise-Δ: mean Δregret (base-repeat − base), registeredDirection=noise-baseline
  (characterizes noise; not a treatment claim).
- A-flip-perturb: flip rate perturb vs base + Wilson.
- A-flip-noise: flip rate base-repeat vs base + Wilson.
  separableFromNoise iff the two Wilson intervals are disjoint; else
  "not separable from run-to-run noise".
Decision rule: treatment effect claimed only if A-Δ separable and separableFromNoise.

## Experiment B — Adversarial context
Hypothesis: Irrelevant/misleading fictional in-game context worsens decisions (higher regret).
Manipulation: inject fictional arena lore that does not change legal actions/oracle.
Variant: advctx / agent-v6-advctx-*.
Comparison B-Δ: mean Δregret (advctx − base), registeredDirection=worse.
Separable iff CI.low > 0.

## Experiment C — Information scaling
Hypothesis: More factual game state improves decisions toward grounded; partial info sits between.
Variant: info-partial / agent-v6-info-partial-* (less than grounded facts; more than base).
Comparisons:
- C-vs-base: Δregret (info-partial − base), registeredDirection=better; separable iff CI.high < 0.
- C-vs-grounded: Δregret (info-partial − grounded), registeredDirection=worse; separable iff CI.low > 0.
Degeneracy (VERIFIED EVAL.md L342): gemini base and grounded made identical choices on all 35
heldout-ext cases. Therefore base → info-partial → grounded monotonicity is **expected-degenerate**
for gemini (comparisons stay registered and reported; labeled expectedDegenerate=true).
Groq: not assumed degenerate a priori.

## Planned comparisons count (primary)
Per pin × {A-Δ, A-noise-Δ, B-Δ, C-vs-base, C-vs-grounded} = 5×2 = 10 Δregret comparisons.
Plus per pin × {A-flip-perturb, A-flip-noise} = 4 flip-rate comparisons.
**Total = 14 primary reports.** Secondary (if recorded): same 14, all insufficientEvidence=true.
No selective reporting.
