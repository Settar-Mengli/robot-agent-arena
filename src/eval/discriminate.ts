import { createGreedySelector } from "../agent";
import { robotEnvironment } from "../env";
import { bestResponse } from "./oracle";
import {
  aggregateMatches,
  wilsonInterval,
  type MatchAggregate,
  type WilsonInterval
} from "./metrics";
import { runSuite, type MatchResult } from "./match";
import {
  greedyCpuPolicy,
  optimalCpuPolicy,
  randomCpuPolicy,
  resolvePlayerPolicy,
  type OptimalCpuPolicy
} from "./policies";
import { buildMatchSuite, type EvalSplit } from "./scenarios";
import { decisionStateKey } from "./snapshots";

export const SPREAD_THRESHOLD = 0.25;

export type PolicyMatchSlice = {
  policy: "random" | "greedy" | "optimal";
  aggregate: MatchAggregate;
  byOpponent: Record<string, MatchAggregate>;
};

export type DecisionHeadroom = {
  decisionPoints: number;
  flatRate: number;
  nonZeroSpreadRate: number;
  greedySuboptimalRate: number;
  meanSpread: number;
  medianSpread: number;
  maxSpread: number;
  spreads: number[];
};

export type DiscriminationSplitReport = {
  split: EvalSplit;
  policies: PolicyMatchSlice[];
  headroom: DecisionHeadroom;
  optimalInexactTurns: number;
  winRateCiDisjoint: boolean;
};

export type DiscriminationReport = {
  splits: DiscriminationSplitReport[];
  verdict: "DISCRIMINATES" | "DOES_NOT_DISCRIMINATE";
  verdictReason: string;
};

export function intervalsDisjoint(
  a: WilsonInterval,
  b: WilsonInterval
): boolean {
  return a.high < b.low || b.high < a.low;
}

export function computeDecisionHeadroom(
  spreads: readonly number[],
  flatCount: number,
  suboptimalCount: number,
  decisionPoints: number
): DecisionHeadroom {
  if (decisionPoints === 0) {
    return {
      decisionPoints: 0,
      flatRate: 0,
      nonZeroSpreadRate: 0,
      greedySuboptimalRate: 0,
      meanSpread: 0,
      medianSpread: 0,
      maxSpread: 0,
      spreads: []
    };
  }
  const sorted = [...spreads].sort((x, y) => x - y);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
  return {
    decisionPoints,
    flatRate: flatCount / decisionPoints,
    nonZeroSpreadRate: 1 - flatCount / decisionPoints,
    greedySuboptimalRate: suboptimalCount / decisionPoints,
    meanSpread: sum / Math.max(1, sorted.length),
    medianSpread: median,
    maxSpread: sorted.length === 0 ? 0 : sorted[sorted.length - 1]!,
    spreads: sorted
  };
}

export function decideDiscriminationVerdict(
  splits: readonly DiscriminationSplitReport[]
): { verdict: DiscriminationReport["verdict"]; reason: string } {
  const disjointSplit = splits.find((s) => s.winRateCiDisjoint);

  // Aggregate headroom across splits for the >25% rule
  let points = 0;
  let nonFlat = 0;
  for (const s of splits) {
    points += s.headroom.decisionPoints;
    nonFlat += Math.round(
      s.headroom.nonZeroSpreadRate * s.headroom.decisionPoints
    );
  }
  const overallNonZeroRate = points === 0 ? 0 : nonFlat / points;
  const spreadOk = overallNonZeroRate > SPREAD_THRESHOLD;
  const disjointOk = disjointSplit !== undefined;

  if (disjointOk && spreadOk) {
    return {
      verdict: "DISCRIMINATES",
      reason: `optimal win-rate CI disjoint from greedy on ${disjointSplit!.split}; non-zero value spread on ${(overallNonZeroRate * 100).toFixed(1)}% of decision points (>${SPREAD_THRESHOLD * 100}%)`
    };
  }
  const parts: string[] = [];
  if (!disjointOk) {
    parts.push("optimal vs greedy win-rate CIs overlap on every split");
  }
  if (!spreadOk) {
    parts.push(
      `non-zero value spread on only ${(overallNonZeroRate * 100).toFixed(1)}% of decision points (need >${SPREAD_THRESHOLD * 100}%)`
    );
  }
  return {
    verdict: "DOES_NOT_DISCRIMINATE",
    reason: parts.join("; ")
  };
}

async function collectHeadroomForSplit(
  split: EvalSplit
): Promise<DecisionHeadroom> {
  const suite = buildMatchSuite(split);
  let flatCount = 0;
  let suboptimalCount = 0;
  const spreads: number[] = [];
  const seenStates = new Set<string>();

  for (const scenario of suite) {
    const playerPolicy = resolvePlayerPolicy(scenario);
    const greedySelect = createGreedySelector(scenario.cpuConfig);
    let runtime = robotEnvironment.start(
      scenario.playerConfig,
      scenario.cpuConfig,
      scenario.seed
    );

    while (!robotEnvironment.isTerminal(runtime)) {
      const playerSkillId = playerPolicy(runtime);
      const stateKey = decisionStateKey(runtime, playerSkillId);
      const affordable = robotEnvironment.legalActions(runtime, "cpu");
      const candidates =
        affordable.length > 0
          ? affordable
          : [robotEnvironment.equippedActions(runtime, "cpu")[0]!];

      if (candidates.length >= 2) {
        const oracle = bestResponse(runtime, playerSkillId, playerPolicy);
        if (oracle.exact && !seenStates.has(stateKey)) {
          seenStates.add(stateKey);
          const vals = candidates.map((id) => oracle.values[id] ?? 0);
          const best = Math.max(...vals);
          const worst = Math.min(...vals);
          const spread = best - worst;
          spreads.push(spread);
          if (spread === 0) {
            flatCount += 1;
          }
          const greedyId = greedySelect(runtime.cpu, runtime.player);
          if (!oracle.best.includes(greedyId)) {
            suboptimalCount += 1;
          }
        }
      }

      runtime = robotEnvironment.apply(
        runtime,
        playerSkillId,
        greedySelect
      ).runtime;
    }
  }

  return computeDecisionHeadroom(
    spreads,
    flatCount,
    suboptimalCount,
    seenStates.size
  );
}

function withByOpponent(
  results: MatchResult[]
): MatchAggregate & { byOpponent: Record<string, MatchAggregate> } {
  const byOpponent: Record<string, MatchAggregate> = {};
  const groups = new Map<string, MatchResult[]>();
  for (const result of results) {
    const list = groups.get(result.opponentId) ?? [];
    list.push(result);
    groups.set(result.opponentId, list);
  }
  for (const [id, group] of [...groups.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : 1
  )) {
    byOpponent[id] = aggregateMatches(group);
  }
  return { ...aggregateMatches(results), byOpponent };
}

export async function runDiscriminationReport(
  log: (line: string) => void = console.log
): Promise<DiscriminationReport> {
  const splits: DiscriminationSplitReport[] = [];

  for (const split of ["dev", "heldout"] as const) {
    log(`discriminate: split=${split} (120 scenarios × 3 policies)`);
    const suite = buildMatchSuite(split);

    const randomResults = await runSuite(suite, randomCpuPolicy());

    const greedyResults: MatchResult[] = [];
    for (const scenario of suite) {
      const [one] = await runSuite(
        [scenario],
        greedyCpuPolicy(scenario.cpuConfig)
      );
      greedyResults.push(one!);
    }

    const optimalResults: MatchResult[] = [];
    let inexact = 0;
    for (const scenario of suite) {
      const playerPolicy = resolvePlayerPolicy(scenario);
      const policy: OptimalCpuPolicy = optimalCpuPolicy(playerPolicy);
      const [one] = await runSuite([scenario], policy);
      optimalResults.push(one!);
      inexact += policy.inexactTurns();
    }

    const policies: PolicyMatchSlice[] = [
      {
        policy: "random",
        aggregate: aggregateMatches(randomResults),
        byOpponent: withByOpponent(randomResults).byOpponent
      },
      {
        policy: "greedy",
        aggregate: aggregateMatches(greedyResults),
        byOpponent: withByOpponent(greedyResults).byOpponent
      },
      {
        policy: "optimal",
        aggregate: aggregateMatches(optimalResults),
        byOpponent: withByOpponent(optimalResults).byOpponent
      }
    ];

    const greedyAgg = policies[1]!.aggregate;
    const optimalAgg = policies[2]!.aggregate;
    const winRateCiDisjoint = intervalsDisjoint(
      greedyAgg.cpuWinWilson,
      optimalAgg.cpuWinWilson
    );

    log(`discriminate: headroom scan for ${split}…`);
    const headroom = await collectHeadroomForSplit(split);

    splits.push({
      split,
      policies,
      headroom,
      optimalInexactTurns: inexact,
      winRateCiDisjoint
    });
  }

  const { verdict, reason } = decideDiscriminationVerdict(splits);
  return { splits, verdict, verdictReason: reason };
}

export function formatDiscriminationSummary(
  report: DiscriminationReport
): string {
  const lines: string[] = [
    "--- discrimination summary ---",
    `verdict: ${report.verdict}`,
    `reason: ${report.verdictReason}`
  ];

  for (const split of report.splits) {
    lines.push(`### split: ${split.split}`);
    lines.push(
      `optimal inexact oracle turns: ${split.optimalInexactTurns}`
    );
    lines.push(
      `win-rate CI disjoint (optimal vs greedy): ${split.winRateCiDisjoint}`
    );
    for (const slice of split.policies) {
      const a = slice.aggregate;
      const w = a.cpuWinWilson;
      lines.push(
        `  ${slice.policy}: n=${a.n} cpuWin=${(a.cpuWinRate * 100).toFixed(2)}% [${(w.low * 100).toFixed(2)}%, ${(w.high * 100).toFixed(2)}%] draw=${(a.drawRate * 100).toFixed(2)}% loss=${(a.lossRate * 100).toFixed(2)}% meanTurns=${a.meanTurns.toFixed(2)} meanHpMargin=${a.meanFinalHpMargin.toFixed(2)}`
      );
    }
    const h = split.headroom;
    lines.push(
      `  headroom: points=${h.decisionPoints} flat=${(h.flatRate * 100).toFixed(1)}% nonZeroSpread=${(h.nonZeroSpreadRate * 100).toFixed(1)}% greedySuboptimal=${(h.greedySuboptimalRate * 100).toFixed(1)}% meanSpread=${h.meanSpread.toFixed(2)} medianSpread=${h.medianSpread.toFixed(2)} maxSpread=${h.maxSpread.toFixed(2)}`
    );
  }

  lines.push("-----------------------------");
  return lines.join("\n");
}

export type DiscriminationPolicySummary = {
  policy: "random" | "greedy" | "optimal";
  n: number;
  cpuWinRate: number;
  cpuWinWilson: { low: number; high: number };
  drawRate: number;
  lossRate: number;
  meanTurns: number;
  meanFinalHpMargin: number;
};

export type DiscriminationHeadroomSummary = {
  decisionPoints: number;
  flatRate: number;
  nonZeroSpreadRate: number;
  greedySuboptimalRate: number;
  meanSpread: number;
  medianSpread: number;
  maxSpread: number;
};

export type DiscriminationSplitSummary = {
  split: EvalSplit;
  policies: DiscriminationPolicySummary[];
  headroom: DiscriminationHeadroomSummary;
  optimalInexactTurns: number;
  winRateCiDisjoint: boolean;
};

export type DiscriminationSummary = {
  verdict: DiscriminationReport["verdict"];
  verdictReason: string;
  overallNonZeroSpreadRate: number;
  splits: DiscriminationSplitSummary[];
};

/**
 * Deterministic aggregate-only view for committed reproduce logs.
 * Omits spreads[], byOpponent, timestamps, paths, and host info.
 */
export function summarizeDiscriminationReport(
  report: DiscriminationReport
): DiscriminationSummary {
  let points = 0;
  let nonFlat = 0;
  for (const s of report.splits) {
    points += s.headroom.decisionPoints;
    nonFlat += Math.round(
      s.headroom.nonZeroSpreadRate * s.headroom.decisionPoints
    );
  }
  const overallNonZeroSpreadRate = points === 0 ? 0 : nonFlat / points;

  const splits: DiscriminationSplitSummary[] = report.splits.map((split) => ({
    split: split.split,
    policies: split.policies.map((slice) => ({
      policy: slice.policy,
      n: slice.aggregate.n,
      cpuWinRate: slice.aggregate.cpuWinRate,
      cpuWinWilson: {
        low: slice.aggregate.cpuWinWilson.low,
        high: slice.aggregate.cpuWinWilson.high
      },
      drawRate: slice.aggregate.drawRate,
      lossRate: slice.aggregate.lossRate,
      meanTurns: slice.aggregate.meanTurns,
      meanFinalHpMargin: slice.aggregate.meanFinalHpMargin
    })),
    headroom: {
      decisionPoints: split.headroom.decisionPoints,
      flatRate: split.headroom.flatRate,
      nonZeroSpreadRate: split.headroom.nonZeroSpreadRate,
      greedySuboptimalRate: split.headroom.greedySuboptimalRate,
      meanSpread: split.headroom.meanSpread,
      medianSpread: split.headroom.medianSpread,
      maxSpread: split.headroom.maxSpread
    },
    optimalInexactTurns: split.optimalInexactTurns,
    winRateCiDisjoint: split.winRateCiDisjoint
  }));

  return {
    verdict: report.verdict,
    verdictReason: report.verdictReason,
    overallNonZeroSpreadRate,
    splits
  };
}

/** Exported for tests — unused import guard. */
export { wilsonInterval };
