/**
 * Batch 4 / D-051 robustness summary types and decision-rule helpers.
 * Phase 1 may emit empty/unavailable rows; Phase 2 fills from recordings.
 */

import {
  bootstrapMeanCi,
  wilsonInterval,
  type BootstrapMeanCi,
  type BootstrapMeanCiOptions,
  type WilsonInterval
} from "../decision-lab";

export const BATCH4_BOOTSTRAP_SEED = 0xa11ce;
export const BATCH4_BOOTSTRAP_B = 2000;
export const BATCH4_BOOTSTRAP_ALPHA = 0.05;

export type Batch4RegisteredDirection =
  | "two-sided"
  | "worse"
  | "better"
  | "noise-baseline";

export type Batch4ComparisonRow = {
  id: string;
  experiment: "A" | "B" | "C" | "noise";
  pin: string;
  variant: string;
  baselineVariant: string;
  registeredDirection: Batch4RegisteredDirection;
  meanDeltaRegret: number;
  deltaRegretCi: { low: number; high: number; mean: number };
  separable: boolean;
  expectedDegenerate?: boolean;
  flipRateVariantVsBase?: number;
  flipRateWilson?: { low: number; high: number };
  flipRateNoiseVsBase?: number;
  flipRateNoiseWilson?: { low: number; high: number };
  separableFromNoise?: boolean;
  optimalRateWilson?: { low: number; high: number };
  insufficientEvidence: boolean;
};

export type Batch4RobustnessSummaryV1 = {
  schemaVersion: 1;
  /** Filled Phase 2; Phase 1 placeholder "". */
  preregistrationCommitSha: string;
  bootstrap: { seed: number; B: number; alpha: number };
  suite: { id: "adversarial-heldout-ext" | "adversarial"; n: number };
  comparisons: Batch4ComparisonRow[];
  notes: string[];
};

/** Paired bootstrap CI of mean (variant − baseline) regret per matched case. */
export function pairedDeltaRegretCi(
  variantRegrets: readonly number[],
  baselineRegrets: readonly number[],
  options: BootstrapMeanCiOptions = {
    seed: BATCH4_BOOTSTRAP_SEED,
    B: BATCH4_BOOTSTRAP_B,
    alpha: BATCH4_BOOTSTRAP_ALPHA
  }
): BootstrapMeanCi {
  if (variantRegrets.length !== baselineRegrets.length) {
    throw new TypeError(
      `pairedDeltaRegretCi: length mismatch ${variantRegrets.length} vs ${baselineRegrets.length}`
    );
  }
  const deltas: number[] = [];
  for (let i = 0; i < variantRegrets.length; i += 1) {
    deltas.push(variantRegrets[i]! - baselineRegrets[i]!);
  }
  return bootstrapMeanCi(deltas, options);
}

/** Flip rate = disagreements / n; Wilson 95% on that proportion. */
export function flipRateWilson(
  flips: number,
  n: number
): { rate: number; wilson: WilsonInterval } {
  if (n <= 0) {
    return { rate: 0, wilson: wilsonInterval(0, 0) };
  }
  return { rate: flips / n, wilson: wilsonInterval(flips, n) };
}

/** Inclusive-endpoint Wilson intervals are disjoint ⇒ separable from noise. */
export function wilsonIntervalsDisjoint(
  a: WilsonInterval,
  b: WilsonInterval
): boolean {
  return a.high < b.low || b.high < a.low;
}

/**
 * Δregret CI separability per pre-registration direction.
 * noise-baseline is never a treatment claim (always false).
 */
export function separableByDirection(
  ci: { low: number; high: number },
  direction: Batch4RegisteredDirection
): boolean {
  switch (direction) {
    case "two-sided":
      return ci.low > 0 || ci.high < 0;
    case "worse":
      return ci.low > 0;
    case "better":
      return ci.high < 0;
    case "noise-baseline":
      return false;
  }
}

/**
 * Experiment A treatment claim: two-sided CI excludes 0 AND flip-rate
 * separable from noise. Other experiments: direction rule only.
 */
export function separableForComparison(input: {
  direction: Batch4RegisteredDirection;
  deltaRegretCi: { low: number; high: number };
  separableFromNoise?: boolean;
}): boolean {
  const byCi = separableByDirection(input.deltaRegretCi, input.direction);
  if (input.direction === "two-sided") {
    return byCi && input.separableFromNoise === true;
  }
  return byCi;
}

/** Phase 1 placeholder — no recorded comparisons yet. */
export function emptyBatch4RobustnessSummary(
  suite: Batch4RobustnessSummaryV1["suite"] = {
    id: "adversarial-heldout-ext",
    n: 35
  }
): Batch4RobustnessSummaryV1 {
  return {
    schemaVersion: 1,
    preregistrationCommitSha: "",
    bootstrap: {
      seed: BATCH4_BOOTSTRAP_SEED,
      B: BATCH4_BOOTSTRAP_B,
      alpha: BATCH4_BOOTSTRAP_ALPHA
    },
    suite,
    comparisons: [],
    notes: [
      "Phase 1 placeholder — comparisons filled after Batch 4 recording (Phase 2)."
    ]
  };
}
