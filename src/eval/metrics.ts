import type { SkillId } from "../engine";
import { robotEnvironment } from "../env";
import type { DecisionTrace } from "../agent";
import {
  bootstrapMeanCi,
  wilsonInterval,
  type WilsonInterval
} from "../decision-lab";
import type { MatchResult } from "./match";
import type { DecisionSnapshot } from "./snapshots";
import { regret } from "./oracle";

export type { WilsonInterval };
export { wilsonInterval, bootstrapMeanCi };

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[idx]!;
}

export type MatchAggregate = {
  /** Distinct-battle count; Wilson denominator and rate denominator. */
  n: number;
  /** Raw MatchResult list length before battle fingerprint dedupe. */
  rawN: number;
  /** Distinct strata (opponent × playerPolicy × cpuPolicy, seed excluded). */
  strataCovered: number;
  /** Alias of n — distinct battle fingerprints. */
  distinctBattles: number;
  cpuWinRate: number;
  drawRate: number;
  lossRate: number;
  cpuWinWilson: WilsonInterval;
  meanTurns: number;
  meanFinalHpMargin: number;
};

/** Full turn trajectory + outcome fingerprint (D-035). */
export function battleFingerprint(result: MatchResult): string {
  return JSON.stringify({
    turns: result.turns.map((t) => ({
      turn: t.turn,
      playerSkillId: t.playerSkillId,
      cpuSource: t.cpuSource
    })),
    outcome: result.outcome.result,
    totalTurns: result.totalTurns,
    finalHpMargin: result.finalHpMargin
  });
}

/** Stratum without seed — opponent × player policy × cpu policy. */
export function matchStratumKey(result: MatchResult): string {
  return `${result.opponentId}|${result.playerPolicy}|${result.cpuPolicyId}`;
}

export function countMatchDiversity(results: readonly MatchResult[]): {
  rawN: number;
  strataCovered: number;
  distinctBattles: number;
} {
  const strata = new Set<string>();
  const battles = new Set<string>();
  for (const result of results) {
    strata.add(matchStratumKey(result));
    battles.add(battleFingerprint(result));
  }
  return {
    rawN: results.length,
    strataCovered: strata.size,
    distinctBattles: battles.size
  };
}

/** First occurrence of each battle fingerprint (stable order). */
export function uniqueBattles(
  results: readonly MatchResult[]
): MatchResult[] {
  const seen = new Set<string>();
  const out: MatchResult[] = [];
  for (const result of results) {
    const key = battleFingerprint(result);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(result);
  }
  return out;
}

export function aggregateMatches(results: readonly MatchResult[]): MatchAggregate {
  const diversity = countMatchDiversity(results);
  const unique = uniqueBattles(results);
  const n = unique.length;
  if (n === 0) {
    return {
      n: 0,
      rawN: diversity.rawN,
      strataCovered: diversity.strataCovered,
      distinctBattles: 0,
      cpuWinRate: 0,
      drawRate: 0,
      lossRate: 0,
      cpuWinWilson: { low: 0, high: 0 },
      meanTurns: 0,
      meanFinalHpMargin: 0
    };
  }

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let turns = 0;
  let margin = 0;

  for (const result of unique) {
    if (result.outcome.result === "cpu-victory") wins += 1;
    else if (result.outcome.result === "draw") draws += 1;
    else losses += 1;
    turns += result.totalTurns;
    margin += result.finalHpMargin;
  }

  return {
    n,
    rawN: diversity.rawN,
    strataCovered: diversity.strataCovered,
    distinctBattles: n,
    cpuWinRate: wins / n,
    drawRate: draws / n,
    lossRate: losses / n,
    cpuWinWilson: wilsonInterval(wins, n),
    meanTurns: turns / n,
    meanFinalHpMargin: margin / n
  };
}

export type ProviderLlmAggregate = {
  decisions: number;
  validOk: number;
  validated: number;
  decisionValidityRate: number | null;
  fallbackCount: number;
  latencyP50: number | null;
  latencyP95: number | null;
  tokenTotals: {
    prompt: number;
    completion: number;
    total: number;
  } | null;
  attemptsOk: number;
  attemptsFailByStatus: Record<string, number>;
};

export type LlmAggregate = {
  decisionValidityRate: number | null;
  fallbackByReason: Record<string, number>;
  /** Total fixture misses (matches + snapshots). */
  fixtureMissCount: number;
  /** Fixture-miss failures on match DecisionTraces. */
  fixtureMissMatches: number;
  /** Fixture-miss failures on snapshot DecisionTraces. */
  fixtureMissSnapshots: number;
  latencyP50: number | null;
  latencyP95: number | null;
  tokenTotals: {
    prompt: number;
    completion: number;
    total: number;
  } | null;
  byProvider: Record<string, ProviderLlmAggregate>;
};

/** Same rule for match and snapshot traces (D-035 fixture coverage). */
export function isFixtureMissFailure(failure: {
  status?: number;
  reason: string;
}): boolean {
  return (
    failure.status === 599 || failure.reason.includes("fixture_miss")
  );
}

export function countFixtureMissFailures(
  failures: readonly { status?: number; reason: string }[] | undefined
): number {
  if (failures === undefined || failures.length === 0) {
    return 0;
  }
  let n = 0;
  for (const failure of failures) {
    if (isFixtureMissFailure(failure)) {
      n += 1;
    }
  }
  return n;
}

export function traceHasFixtureMiss(trace: {
  failures?: readonly { status?: number; reason: string }[];
}): boolean {
  return countFixtureMissFailures(trace.failures) > 0;
}

/** Attach snapshot miss tallies; fixtureMissCount becomes matches + snapshots. */
export function withSnapshotFixtureMisses(
  agg: LlmAggregate,
  fixtureMissSnapshots: number
): LlmAggregate {
  const fixtureMissMatches = agg.fixtureMissMatches;
  return {
    ...agg,
    fixtureMissSnapshots,
    fixtureMissCount: fixtureMissMatches + fixtureMissSnapshots
  };
}

type ProviderBucket = {
  decisions: number;
  validOk: number;
  validated: number;
  fallbackCount: number;
  latencies: number[];
  prompt: number;
  completion: number;
  total: number;
  usageSeen: boolean;
  attemptsOk: number;
  attemptsFailByStatus: Record<string, number>;
};

function providerKey(provider: string, model: string): string {
  return `${provider}|${model}`;
}

function emptyProviderBucket(): ProviderBucket {
  return {
    decisions: 0,
    validOk: 0,
    validated: 0,
    fallbackCount: 0,
    latencies: [],
    prompt: 0,
    completion: 0,
    total: 0,
    usageSeen: false,
    attemptsOk: 0,
    attemptsFailByStatus: {}
  };
}

function finalizeProviderBucket(
  bucket: ProviderBucket,
  replay: boolean
): ProviderLlmAggregate {
  const latencies = [...bucket.latencies].sort((a, b) => a - b);
  const failStatuses = Object.keys(bucket.attemptsFailByStatus).sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  const attemptsFailByStatus: Record<string, number> = {};
  for (const status of failStatuses) {
    attemptsFailByStatus[status] = bucket.attemptsFailByStatus[status]!;
  }
  return {
    decisions: bucket.decisions,
    validOk: bucket.validOk,
    validated: bucket.validated,
    decisionValidityRate:
      bucket.validated === 0 ? null : bucket.validOk / bucket.validated,
    fallbackCount: bucket.fallbackCount,
    latencyP50: replay ? null : percentile(latencies, 50),
    latencyP95: replay ? null : percentile(latencies, 95),
    tokenTotals: bucket.usageSeen
      ? {
          prompt: bucket.prompt,
          completion: bucket.completion,
          total: bucket.total
        }
      : null,
    attemptsOk: bucket.attemptsOk,
    attemptsFailByStatus
  };
}

export function aggregateLlm(
  results: readonly MatchResult[],
  options: { replayMode?: boolean } = {}
): LlmAggregate {
  let validated = 0;
  let validOk = 0;
  const fallbackByReason: Record<string, number> = {};
  let fixtureMissMatches = 0;
  const latencies: number[] = [];
  let prompt = 0;
  let completion = 0;
  let total = 0;
  let usageSeen = false;
  const providerBuckets = new Map<string, ProviderBucket>();

  const getBucket = (key: string): ProviderBucket => {
    let bucket = providerBuckets.get(key);
    if (bucket === undefined) {
      bucket = emptyProviderBucket();
      providerBuckets.set(key, bucket);
    }
    return bucket;
  };

  for (const result of results) {
    for (const turn of result.turns) {
      const trace = turn.trace;
      if (trace === undefined) continue;

      if (trace.validation !== undefined) {
        validated += 1;
        if (trace.validation.ok) validOk += 1;
      }
      if (trace.fallbackReason !== undefined) {
        fallbackByReason[trace.fallbackReason] =
          (fallbackByReason[trace.fallbackReason] ?? 0) + 1;
      }
      fixtureMissMatches += countFixtureMissFailures(trace.failures);
      latencies.push(trace.elapsedMs);
      if (trace.usage !== undefined) {
        usageSeen = true;
        prompt += trace.usage.prompt_tokens ?? 0;
        completion += trace.usage.completion_tokens ?? 0;
        total += trace.usage.total_tokens ?? 0;
      }

      if (trace.provider !== undefined && trace.model !== undefined) {
        const bucket = getBucket(providerKey(trace.provider, trace.model));
        bucket.decisions += 1;
        if (trace.validation !== undefined) {
          bucket.validated += 1;
          if (trace.validation.ok) bucket.validOk += 1;
        }
        if (trace.source === "fallback") {
          bucket.fallbackCount += 1;
        }
        bucket.latencies.push(trace.elapsedMs);
        if (trace.usage !== undefined) {
          bucket.usageSeen = true;
          bucket.prompt += trace.usage.prompt_tokens ?? 0;
          bucket.completion += trace.usage.completion_tokens ?? 0;
          bucket.total += trace.usage.total_tokens ?? 0;
        }
      }

      for (const attempt of trace.attempts) {
        const bucket = getBucket(providerKey(attempt.provider, attempt.model));
        if (attempt.ok) {
          bucket.attemptsOk += 1;
        } else {
          const statusKey =
            attempt.status === undefined ? "none" : String(attempt.status);
          bucket.attemptsFailByStatus[statusKey] =
            (bucket.attemptsFailByStatus[statusKey] ?? 0) + 1;
        }
      }
    }
  }

  latencies.sort((a, b) => a - b);
  const replay = options.replayMode === true;

  const byProvider: Record<string, ProviderLlmAggregate> = {};
  for (const key of [...providerBuckets.keys()].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0
  )) {
    byProvider[key] = finalizeProviderBucket(providerBuckets.get(key)!, replay);
  }

  return {
    decisionValidityRate:
      validated === 0 ? null : validOk / validated,
    fallbackByReason,
    fixtureMissCount: fixtureMissMatches,
    fixtureMissMatches,
    fixtureMissSnapshots: 0,
    latencyP50: replay ? null : percentile(latencies, 50),
    latencyP95: replay ? null : percentile(latencies, 95),
    tokenTotals: usageSeen
      ? { prompt, completion, total }
      : null,
    byProvider
  };
}

/**
 * Exact expectation for the engine's private random picker
 * (simulation.ts selectSimulationSkillId): uniform over affordable
 * equipped skills; else skillIds[0].
 */
export function randomPolicyExpectation(
  snapshot: DecisionSnapshot
): { optimalRate: number; meanRegret: number; maxRegret: number } {
  const skillIds = robotEnvironment.equippedActions(snapshot.runtime, "cpu");
  const affordable = robotEnvironment.legalActions(snapshot.runtime, "cpu");
  const candidates =
    affordable.length > 0 ? affordable : [skillIds[0]!];

  let optimalHits = 0;
  let regretSum = 0;
  let maxRegret = 0;
  const bestSet = new Set(snapshot.best);

  for (const skillId of candidates) {
    const isOptimal = bestSet.has(skillId);
    if (isOptimal) optimalHits += 1;
    const r = regret(snapshot.values, skillId);
    regretSum += r;
    if (r > maxRegret) maxRegret = r;
  }

  const n = candidates.length;
  return {
    optimalRate: optimalHits / n,
    meanRegret: regretSum / n,
    maxRegret
  };
}

export type SnapshotPolicyMetrics = {
  n: number;
  optimalRate: number;
  meanRegret: number;
  medianRegret: number;
  maxRegret: number;
  /** Decisions (or per-snapshot for random) with regret ≥ 100. */
  highRegretCount: number;
  invalidDecisionRate?: number;
  /** Wilson 95% CI on optimal rate (successes = optimal hits). */
  optimalRateWilson: WilsonInterval;
  /** Seeded bootstrap 95% CI on mean regret. */
  meanRegretCi: { low: number; high: number; mean: number };
};

function medianOf(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function metricsForChosenMoves(
  snapshots: readonly DecisionSnapshot[],
  chosen: readonly SkillId[],
  options: { invalidFlags?: readonly boolean[] } = {}
): SnapshotPolicyMetrics {
  if (snapshots.length !== chosen.length) {
    throw new Error("snapshots and chosen length mismatch");
  }

  let optimal = 0;
  let regretSum = 0;
  let maxRegret = 0;
  let highRegretCount = 0;
  let invalid = 0;
  const regrets: number[] = [];

  for (let i = 0; i < snapshots.length; i += 1) {
    const snap = snapshots[i]!;
    const skillId = chosen[i]!;
    if (snap.best.includes(skillId)) optimal += 1;
    const r = regret(snap.values, skillId);
    regrets.push(r);
    regretSum += r;
    if (r > maxRegret) maxRegret = r;
    if (r >= 100) highRegretCount += 1;
    if (options.invalidFlags?.[i] === true) invalid += 1;
  }

  const n = snapshots.length;
  const optimalRate = n === 0 ? 0 : optimal / n;
  const meanRegret = n === 0 ? 0 : regretSum / n;
  return {
    n,
    optimalRate,
    meanRegret,
    medianRegret: medianOf(regrets),
    maxRegret,
    highRegretCount,
    optimalRateWilson: wilsonInterval(optimal, n),
    meanRegretCi: bootstrapMeanCi(regrets),
    ...(options.invalidFlags !== undefined
      ? { invalidDecisionRate: n === 0 ? 0 : invalid / n }
      : {})
  };
}

export function greedyChoice(snapshot: DecisionSnapshot): SkillId {
  // Greedy selector is re-run by callers; this helper picks first best by catalog order among values max.
  return snapshot.best[0]!;
}

export type TraceDecision = {
  skillId: SkillId;
  invalid: boolean;
};

export function decisionFromTrace(
  trace: DecisionTrace,
  fallbackSkillId: SkillId
): TraceDecision {
  const skillId = trace.executedSkillId ?? fallbackSkillId;
  const invalid =
    trace.source === "fallback" ||
    (trace.validation !== undefined && !trace.validation.ok);
  return { skillId, invalid };
}

/** Compare LLM (or other) policy metrics to a measured suite baseline (greedy/random). */
export type SuiteBaselineDelta = {
  variant: string;
  suiteLabel: string;
  baselineId: "greedy" | "random";
  policy: SnapshotPolicyMetrics;
  baseline: SnapshotPolicyMetrics;
  deltaOptimalRate: number;
  deltaMeanRegret: number;
};

export function deltaVsSuiteBaseline(
  variant: string,
  suiteLabel: string,
  baselineId: "greedy" | "random",
  policy: SnapshotPolicyMetrics,
  baseline: SnapshotPolicyMetrics
): SuiteBaselineDelta {
  return {
    variant,
    suiteLabel,
    baselineId,
    policy,
    baseline,
    deltaOptimalRate: policy.optimalRate - baseline.optimalRate,
    deltaMeanRegret: policy.meanRegret - baseline.meanRegret
  };
}
