/**
 * Batch 8 diagnostics — pure aggregates over Decision Lab packs.
 * No Node, eval, React, or DOM imports.
 */
import {
  insufficientEvidence,
  wilsonInterval,
  type WilsonInterval
} from "./stats";
import type {
  DecisionLabAffordability,
  DecisionLabObservation,
  DecisionLabPolicyEvidence,
  DecisionLabRecordedPolicy
} from "./pack-v1";

export type FailureTag =
  | "missed_lethal"
  | "ignored_incoming_threat"
  | "wasted_energy"
  | "over_defending"
  | "other_suboptimal";

export const FAILURE_TAGS: readonly FailureTag[] = [
  "missed_lethal",
  "ignored_incoming_threat",
  "wasted_energy",
  "over_defending",
  "other_suboptimal"
] as const;

export type ClassifyFailureTagsInput = {
  taxonomy: string;
  regret: number;
  executedSkillId: string;
  oracleBest: readonly string[];
  affordability: readonly DecisionLabAffordability[];
  observation: DecisionLabObservation;
  /** Per equipped skill: lethal vs player at decision time. */
  lethalBySkill: Readonly<Record<string, boolean>>;
  diesNextTurnPreAction: boolean;
  /** After executing the chosen skill, would CPU still die next turn? */
  diesNextTurnAfterChosen: boolean;
  chosenCategory: string;
};

/**
 * Descriptive failure tags for suboptimal recorded decisions (D-049).
 * Not causal claims about the model.
 */
export function classifyFailureTags(
  input: ClassifyFailureTagsInput
): FailureTag[] {
  if (input.taxonomy !== "suboptimal") {
    return [];
  }

  const tags: FailureTag[] = [];
  const costById = new Map(
    input.affordability.map((a) => [a.skillId, a] as const)
  );
  const chosenAff = costById.get(input.executedSkillId);

  const lethalAffordable = Object.entries(input.lethalBySkill)
    .filter(([id, lethal]) => {
      if (!lethal) return false;
      const aff = costById.get(id);
      return aff?.affordable === true;
    })
    .map(([id]) => id);

  if (
    lethalAffordable.length > 0 &&
    !lethalAffordable.includes(input.executedSkillId)
  ) {
    tags.push("missed_lethal");
  }

  if (input.diesNextTurnPreAction && input.diesNextTurnAfterChosen) {
    tags.push("ignored_incoming_threat");
  }

  if (input.regret > 0 && chosenAff !== undefined) {
    const cheaperBest = input.oracleBest.some((bestId) => {
      const bestAff = costById.get(bestId);
      return (
        bestAff !== undefined &&
        bestAff.affordable &&
        chosenAff.energyCost > bestAff.energyCost
      );
    });
    if (cheaperBest) {
      tags.push("wasted_energy");
    }
  }

  if (
    input.regret > 0 &&
    input.observation.cpu.health === input.observation.cpu.maxHealth &&
    input.chosenCategory === "defense"
  ) {
    tags.push("over_defending");
  }

  if (tags.length === 0) {
    tags.push("other_suboptimal");
  }
  return tags;
}

export type RegretBucketId = "zero" | "low" | "mid" | "high";

export type RegretBucket = {
  id: RegretBucketId;
  label: string;
  count: number;
};

export type FailureCluster = {
  tag: FailureTag;
  count: number;
  policyKeys: string[];
};

export type HelpRankingRow = {
  policyKey: string;
  baselineKey: string;
  n: number;
  meanDeltaRegret: number;
  improvedCases: number;
  improvedRate: number;
  wilson: WilsonInterval;
  insufficientEvidence: boolean;
  wording: string;
};

export type Counterexample = {
  snapshotId: string;
  policyKey: string;
  regret: number;
  executedSkillId: string;
  oracleBest: string[];
  modelReason?: string;
  observation: DecisionLabObservation;
};

export type DiagnosticsReport = {
  schemaVersion: 1;
  nCases: number;
  clusters: FailureCluster[];
  stakes: RegretBucket[];
  helpRanking: HelpRankingRow[];
  counterexample: Counterexample | null;
  honesty: string[];
};

export type DiagnosticsCaseView = {
  snapshotId: string;
  observation: DecisionLabObservation;
  oracleBest: string[];
  policies: Record<string, DecisionLabPolicyEvidence & { failureTags?: FailureTag[] }>;
};

function isRecorded(
  p: DecisionLabPolicyEvidence
): p is DecisionLabRecordedPolicy {
  return p.status === "recorded";
}

function modelReasonFromPolicy(
  p: DecisionLabRecordedPolicy
): string | undefined {
  const v = p.trace?.validation;
  if (
    v !== null &&
    typeof v === "object" &&
    "reason" in v &&
    typeof (v as { reason?: unknown }).reason === "string"
  ) {
    return (v as { reason: string }).reason;
  }
  return p.trace?.rawText;
}

function regretBucket(regret: number): RegretBucketId {
  if (regret === 0) return "zero";
  if (regret <= 10) return "low";
  if (regret < 100) return "mid";
  return "high";
}

/**
 * Build diagnostics from pack cases (failureTags already attached on policies).
 */
export function buildDiagnosticsReport(
  cases: readonly DiagnosticsCaseView[],
  options: {
    /** Paired help ranking: compare these LLM keys vs baselineKey on shared cases. */
    helpPairs?: Array<{ policyKey: string; baselineKey: string }>;
  } = {}
): DiagnosticsReport {
  const clusterMap = new Map<FailureTag, { count: number; keys: Set<string> }>();
  for (const tag of FAILURE_TAGS) {
    clusterMap.set(tag, { count: 0, keys: new Set() });
  }

  const stakesCount: Record<RegretBucketId, number> = {
    zero: 0,
    low: 0,
    mid: 0,
    high: 0
  };

  let counterexample: Counterexample | null = null;

  for (const c of cases) {
    for (const [policyKey, pol] of Object.entries(c.policies)) {
      if (!isRecorded(pol) || pol.source !== "llm") {
        continue;
      }
      stakesCount[regretBucket(pol.regret)] += 1;

      if (pol.taxonomy === "suboptimal") {
        const tags =
          pol.failureTags && pol.failureTags.length > 0
            ? pol.failureTags
            : (["other_suboptimal"] as FailureTag[]);
        for (const tag of tags) {
          const entry = clusterMap.get(tag) ?? {
            count: 0,
            keys: new Set<string>()
          };
          entry.count += 1;
          entry.keys.add(policyKey);
          clusterMap.set(tag, entry);
        }
      }

      const candidate: Counterexample = {
        snapshotId: c.snapshotId,
        policyKey,
        regret: pol.regret,
        executedSkillId: pol.executedSkillId,
        oracleBest: [...c.oracleBest],
        observation: c.observation,
        ...(modelReasonFromPolicy(pol) !== undefined
          ? { modelReason: modelReasonFromPolicy(pol) }
          : {})
      };
      if (
        counterexample === null ||
        candidate.regret > counterexample.regret ||
        (candidate.regret === counterexample.regret &&
          candidate.snapshotId < counterexample.snapshotId) ||
        (candidate.regret === counterexample.regret &&
          candidate.snapshotId === counterexample.snapshotId &&
          candidate.policyKey < counterexample.policyKey)
      ) {
        counterexample = candidate;
      }
    }
  }

  const clusters: FailureCluster[] = FAILURE_TAGS.map((tag) => {
    const entry = clusterMap.get(tag)!;
    return {
      tag,
      count: entry.count,
      policyKeys: [...entry.keys].sort()
    };
  });

  const stakes: RegretBucket[] = [
    { id: "zero", label: "{0}", count: stakesCount.zero },
    { id: "low", label: "(0,10]", count: stakesCount.low },
    { id: "mid", label: "(10,100)", count: stakesCount.mid },
    { id: "high", label: "[100,∞)", count: stakesCount.high }
  ];

  const helpPairs = options.helpPairs ?? [];
  const helpRanking: HelpRankingRow[] = helpPairs.map(({ policyKey, baselineKey }) => {
    let n = 0;
    let sumDelta = 0;
    let improved = 0;
    for (const c of cases) {
      const base = c.policies[baselineKey];
      const alt = c.policies[policyKey];
      if (
        base === undefined ||
        alt === undefined ||
        !isRecorded(base) ||
        !isRecorded(alt)
      ) {
        continue;
      }
      n += 1;
      const delta = alt.regret - base.regret;
      sumDelta += delta;
      if (alt.regret < base.regret) {
        improved += 1;
      }
    }
    const meanDeltaRegret = n === 0 ? 0 : sumDelta / n;
    const improvedRate = n === 0 ? 0 : improved / n;
    const wilson = wilsonInterval(improved, n);
    const insuff = insufficientEvidence({ n, wilson });
    const wording = `On this pack, ${policyKey} coincided with lower regret than ${baselineKey} on ${improved}/${n} cases (mean Δregret=${meanDeltaRegret.toFixed(2)}). Not a causal claim.`;
    return {
      policyKey,
      baselineKey,
      n,
      meanDeltaRegret,
      improvedCases: improved,
      improvedRate,
      wilson,
      insufficientEvidence: insuff,
      wording
    };
  });

  return {
    schemaVersion: 1,
    nCases: cases.length,
    clusters,
    stakes,
    helpRanking,
    counterexample,
    honesty: [
      "Oracle is exact best response vs a fixed player policy — not an equilibrium.",
      "Failure tags are descriptive labels on measured suboptimal decisions — not causal.",
      "Replay / fixture evidence is not live AI.",
      "Small n or wide Wilson intervals → insufficient evidence; no universal rankings."
    ]
  };
}

/** Compact summary for committed diagnostics.summary.json / vs-published strip. */
export type DiagnosticsSummaryV1 = {
  schemaVersion: 1;
  generatedBy: "lab:diagnostics";
  nCases: number;
  clusterCounts: Record<FailureTag, number>;
  stakes: RegretBucket[];
  helpRanking: Array<{
    policyKey: string;
    baselineKey: string;
    n: number;
    meanDeltaRegret: number;
    improvedRate: number;
    wilson: WilsonInterval;
    insufficientEvidence: boolean;
  }>;
  counterexample: {
    snapshotId: string;
    policyKey: string;
    regret: number;
  } | null;
  optimalRateByPolicy: Record<
    string,
    { n: number; optimal: number; rate: number; wilson: WilsonInterval; insufficientEvidence: boolean }
  >;
};

export function summarizeDiagnostics(
  report: DiagnosticsReport,
  cases: readonly DiagnosticsCaseView[]
): DiagnosticsSummaryV1 {
  const clusterCounts = Object.fromEntries(
    report.clusters.map((c) => [c.tag, c.count])
  ) as Record<FailureTag, number>;

  const optimalRateByPolicy: DiagnosticsSummaryV1["optimalRateByPolicy"] = {};
  const keys = new Set<string>();
  for (const c of cases) {
    for (const k of Object.keys(c.policies)) keys.add(k);
  }
  for (const key of [...keys].sort()) {
    let n = 0;
    let optimal = 0;
    for (const c of cases) {
      const p = c.policies[key];
      if (p === undefined || !isRecorded(p) || p.source !== "llm") continue;
      n += 1;
      if (p.optimal) optimal += 1;
    }
    if (n === 0) continue;
    const wilson = wilsonInterval(optimal, n);
    optimalRateByPolicy[key] = {
      n,
      optimal,
      rate: optimal / n,
      wilson,
      insufficientEvidence: insufficientEvidence({ n, wilson })
    };
  }

  return {
    schemaVersion: 1,
    generatedBy: "lab:diagnostics",
    nCases: report.nCases,
    clusterCounts,
    stakes: report.stakes,
    helpRanking: report.helpRanking.map((h) => ({
      policyKey: h.policyKey,
      baselineKey: h.baselineKey,
      n: h.n,
      meanDeltaRegret: h.meanDeltaRegret,
      improvedRate: h.improvedRate,
      wilson: h.wilson,
      insufficientEvidence: h.insufficientEvidence
    })),
    counterexample:
      report.counterexample === null
        ? null
        : {
            snapshotId: report.counterexample.snapshotId,
            policyKey: report.counterexample.policyKey,
            regret: report.counterexample.regret
          },
    optimalRateByPolicy
  };
}
