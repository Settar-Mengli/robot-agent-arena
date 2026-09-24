import type { EnvironmentOf } from "../env";
import { insufficientEvidence } from "../decision-lab";
import {
  aggregateChoiceMetrics,
  type SnapshotPolicyMetrics
} from "./metrics";

export type ChoiceOracleResult<A extends string> = {
  values: Record<A, number>;
  best: A[];
  exact: boolean;
};

export type EvaluateChoicesCase<S> = {
  id: string;
  state: S;
};

export type EvaluateChoicesPerCase<A extends string> = {
  id: string;
  chosen: A;
  regret: number;
  optimal: boolean;
  valueSpread: number;
};

export type EvaluateChoicesResult<A extends string> = {
  perCase: EvaluateChoicesPerCase<A>[];
  metrics: SnapshotPolicyMetrics;
  insufficientEvidence: boolean;
};

function regretOf<A extends string>(
  values: Record<A, number>,
  chosen: A,
  best: readonly A[],
  legal: readonly A[]
): { regret: number; optimal: boolean; spread: number } {
  // Regret max matches robot oracle.regret: over all recorded finite values.
  let max = -Infinity;
  for (const k of Object.keys(values) as A[]) {
    const v = values[k]!;
    if (Number.isFinite(v) && v > max) max = v;
  }
  // Spread = max−min over legal actions only (Batch 5 informativeness).
  let legalMax = -Infinity;
  let legalMin = Infinity;
  for (const k of legal) {
    const v = values[k];
    if (v === undefined || !Number.isFinite(v)) continue;
    if (v > legalMax) legalMax = v;
    if (v < legalMin) legalMin = v;
  }
  const spread =
    Number.isFinite(legalMax) && Number.isFinite(legalMin)
      ? legalMax - legalMin
      : 0;
  const chosenV = values[chosen];
  if (chosenV === undefined || !Number.isFinite(chosenV)) {
    return {
      regret: Number.POSITIVE_INFINITY,
      optimal: false,
      spread
    };
  }
  return {
    regret: max - chosenV,
    optimal: best.includes(chosen),
    spread
  };
}

/**
 * Environment-agnostic evaluation: oracle + policy → per-case regret → shared metrics.
 * Shared with robot (via adapter) and Resonance Seal. Does not touch LLM/agent paths.
 */
export function evaluateChoices<S, A extends string>(input: {
  env: EnvironmentOf<S, A>;
  cases: readonly EvaluateChoicesCase<S>[];
  policy: (state: S) => A;
  oracle: (state: S) => ChoiceOracleResult<A>;
}): EvaluateChoicesResult<A> {
  const regrets: number[] = [];
  const optimalFlags: boolean[] = [];
  const perCase: EvaluateChoicesPerCase<A>[] = [];

  for (const c of input.cases) {
    const oracle = input.oracle(c.state);
    const chosen = input.policy(c.state);
    const legal = input.env.legalActions(c.state);
    const { regret, optimal, spread } = regretOf(
      oracle.values,
      chosen,
      oracle.best,
      legal
    );
    regrets.push(regret);
    optimalFlags.push(optimal);
    perCase.push({
      id: c.id,
      chosen,
      regret,
      optimal,
      valueSpread: spread
    });
  }

  const metrics = aggregateChoiceMetrics({ regrets, optimalFlags });
  return {
    perCase,
    metrics,
    insufficientEvidence: insufficientEvidence({
      n: metrics.n,
      wilson: metrics.optimalRateWilson
    })
  };
}
