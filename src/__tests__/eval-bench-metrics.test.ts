import { describe, expect, it } from "vitest";
import {
  aggregateLiveLatencies,
  assertBenchQuotaWithinCap,
  buildBenchRow,
  buildFailureTaxonomy,
  computeConsistencyMetrics,
  consistencySampleForSnapshot,
  loadPricing,
  lookupCostUsd,
  projectBenchQuotaCalls
} from "../eval/bench";
import type { SnapshotPolicyMetrics } from "../eval/metrics";
import { wilsonInterval } from "../decision-lab";

function metricsStub(
  partial: Partial<SnapshotPolicyMetrics> &
    Pick<SnapshotPolicyMetrics, "n" | "optimalRate" | "meanRegret">
): SnapshotPolicyMetrics {
  const { n, optimalRate, meanRegret } = partial;
  return {
    medianRegret: meanRegret,
    maxRegret: meanRegret,
    highRegretCount: 0,
    optimalRateWilson: wilsonInterval(Math.round(optimalRate * n), n),
    meanRegretCi: { low: meanRegret, high: meanRegret, mean: meanRegret },
    ...partial,
    n,
    optimalRate,
    meanRegret
  };
}

describe("bench metrics / taxonomy / consistency / cost / quota", () => {
  it("aggregates a bench row from snapshot metrics + baselines", () => {
    const metrics = metricsStub({
      n: 10,
      optimalRate: 0.6,
      meanRegret: 40,
      medianRegret: 20,
      maxRegret: 120,
      highRegretCount: 2,
      invalidDecisionRate: 0.1
    });
    const greedy = metricsStub({
      n: 10,
      optimalRate: 0.8,
      meanRegret: 10,
      medianRegret: 5,
      maxRegret: 50,
      highRegretCount: 0
    });
    const row = buildBenchRow(
      {
        model: "gemini:gemini-3.5-flash-lite",
        variant: "base",
        split: "heldout",
        snapshotSuite: "adversarial"
      },
      metrics,
      {
        fallbackCount: 1,
        greedyBaseline: greedy,
        taxonomy: buildFailureTaxonomy([
          { validationCode: "no_json", fallbackReason: "invalid_output" },
          { fallbackReason: "invalid_output" }
        ])
      }
    );
    expect(row.n).toBe(10);
    expect(row.optimalRate).toBe(0.6);
    expect(row.highRegret).toBe(2);
    expect(row.validityRate).toBeCloseTo(0.9);
    expect(row.fallbackCount).toBe(1);
    expect(row.deltaVsGreedy!.deltaOptimalRate).toBeCloseTo(-0.2);
    expect(row.taxonomy.validationCodes.no_json).toBe(1);
    expect(row.taxonomy.fallbackReasons.invalid_output).toBe(2);
  });

  it("groups failure taxonomy codes deterministically", () => {
    const tax = buildFailureTaxonomy(
      [
        { validationCode: "not_equipped" },
        { validationCode: "no_json" },
        { validationCode: "no_json", fallbackReason: "cancelled" }
      ],
      { "429": 2, "500": 1 }
    );
    expect(Object.keys(tax.validationCodes)).toEqual(["no_json", "not_equipped"]);
    expect(Object.keys(tax.attemptFailByStatus)).toEqual(["429", "500"]);
  });

  it("computes consistency agreeRate / distinct / regret spread", () => {
    const samples = [
      { picks: ["a", "a", "a"] as never[], regrets: [0, 0, 0] },
      { picks: ["a", "b", "a"] as never[], regrets: [10, 50, 10] }
    ];
    const m = computeConsistencyMetrics(samples);
    expect(m.n).toBe(2);
    expect(m.agreeRate).toBe(0.5);
    expect(m.meanDistinctPicks).toBe(1.5);
    expect(m.regretSpreadAcrossRepeats).toBe(20);
  });

  it("consistencySampleForSnapshot maps regrets from values", () => {
    const snap = {
      values: { "skill-a": 100, "skill-b": 40 }
    } as never;
    const sample = consistencySampleForSnapshot(snap, [
      "skill-a" as never,
      "skill-b" as never
    ]);
    expect(sample.regrets[0]).toBe(0);
    expect(sample.regrets[1]).toBe(60);
  });

  it("pricing returns 0 for free-tier and null when unpriced", () => {
    const pricing = loadPricing();
    expect(
      lookupCostUsd(pricing, "gemini", "gemini-3.5-flash-lite", 1000, 500)
    ).toBe(0);
    expect(lookupCostUsd(pricing, "openrouter", "mystery-model", 1, 1)).toBeNull();
  });

  it("latency is null in replay; p50/p95/p99 from live only", () => {
    const replay = aggregateLiveLatencies([10, 20, 30], 5, true);
    expect(replay.p50).toBeNull();
    expect(replay.cacheHits).toBe(5);
    const live = aggregateLiveLatencies([10, 20, 30, 40, 100], 2, false);
    expect(live.p50).not.toBeNull();
    expect(live.p99).not.toBeNull();
  });

  it("projects bench quota and refuses >300 without --force-quota", () => {
    // 3 models × 2 variants × (20 snapshots + 0×17) × consistency 3 = 360
    const projected = projectBenchQuotaCalls(3, 2, 20, 0, 3);
    expect(projected).toBe(360);
    expect(() => assertBenchQuotaWithinCap(projected, false)).toThrow(/360/);
    expect(() => assertBenchQuotaWithinCap(projected, true)).not.toThrow();
  });
});
