import type { SkillId } from "../engine";
import { findSkillDefinition, MVP_SKILL_CATALOG } from "../engine";
import type { DecisionTrace } from "../agent";
import type { MatchResult } from "./match";
import type { DecisionSnapshot } from "./snapshots";
import { regret } from "./oracle";

export type WilsonInterval = {
  low: number;
  high: number;
};

/** Wilson score interval for a binomial proportion (z ≈ 1.96 → ~95%). */
export function wilsonInterval(
  successes: number,
  n: number,
  z = 1.96
): WilsonInterval {
  if (n <= 0) {
    return { low: 0, high: 0 };
  }
  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin =
    z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return {
    low: (center - margin) / denom,
    high: (center + margin) / denom
  };
}

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
  n: number;
  cpuWinRate: number;
  drawRate: number;
  lossRate: number;
  cpuWinWilson: WilsonInterval;
  meanTurns: number;
  meanFinalHpMargin: number;
};

export function aggregateMatches(results: readonly MatchResult[]): MatchAggregate {
  const n = results.length;
  if (n === 0) {
    return {
      n: 0,
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

  for (const result of results) {
    if (result.outcome.result === "cpu-victory") wins += 1;
    else if (result.outcome.result === "draw") draws += 1;
    else losses += 1;
    turns += result.totalTurns;
    margin += result.finalHpMargin;
  }

  return {
    n,
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
  fixtureMissCount: number;
  latencyP50: number | null;
  latencyP95: number | null;
  tokenTotals: {
    prompt: number;
    completion: number;
    total: number;
  } | null;
  byProvider: Record<string, ProviderLlmAggregate>;
};

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
  let fixtureMissCount = 0;
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
      for (const failure of trace.failures ?? []) {
        if (
          failure.status === 599 ||
          failure.reason.includes("fixture_miss")
        ) {
          fixtureMissCount += 1;
        }
      }
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
    fixtureMissCount,
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
  const energy = snapshot.runtime.cpu.energy;
  const skillIds = snapshot.runtime.session.cpu.skillIds;
  const affordable = skillIds.filter((skillId) => {
    const skill = findSkillDefinition(MVP_SKILL_CATALOG, skillId);
    return skill !== undefined && skill.energyCost <= energy;
  });
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
  maxRegret: number;
  invalidDecisionRate?: number;
};

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
  let invalid = 0;

  for (let i = 0; i < snapshots.length; i += 1) {
    const snap = snapshots[i]!;
    const skillId = chosen[i]!;
    if (snap.best.includes(skillId)) optimal += 1;
    const r = regret(snap.values, skillId);
    regretSum += r;
    if (r > maxRegret) maxRegret = r;
    if (options.invalidFlags?.[i] === true) invalid += 1;
  }

  const n = snapshots.length;
  return {
    n,
    optimalRate: n === 0 ? 0 : optimal / n,
    meanRegret: n === 0 ? 0 : regretSum / n,
    maxRegret,
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
