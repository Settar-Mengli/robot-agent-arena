import { describe, expect, it } from "vitest";
import {
  BATCH4_BOOTSTRAP_B,
  BATCH4_BOOTSTRAP_SEED,
  QUOTA_CALL_CAP,
  emptyBatch4RobustnessSummary,
  flipRateWilson,
  pairedDeltaRegretCi,
  projectBenchQuotaCalls,
  separableByDirection,
  separableForComparison,
  wilsonIntervalsDisjoint
} from "../eval";

describe("batch4-summary helpers", () => {
  it("projects primary call budget 2×4×35=280 ≤ 300", () => {
    const projected = projectBenchQuotaCalls(2, 4, 35, 0, 1);
    expect(projected).toBe(280);
    expect(projected).toBeLessThanOrEqual(QUOTA_CALL_CAP);
  });

  it("pairedDeltaRegretCi is [0,0] when all paired deltas are 0", () => {
    const zeros = [0, 0, 0, 0, 0];
    const ci = pairedDeltaRegretCi(zeros, zeros, {
      seed: BATCH4_BOOTSTRAP_SEED,
      B: BATCH4_BOOTSTRAP_B,
      alpha: 0.05
    });
    expect(ci.mean).toBe(0);
    expect(ci.low).toBe(0);
    expect(ci.high).toBe(0);
    expect(separableByDirection(ci, "two-sided")).toBe(false);
    expect(separableByDirection(ci, "worse")).toBe(false);
    expect(separableByDirection(ci, "better")).toBe(false);
  });

  it("pairedDeltaRegretCi uses bootstrap on per-case deltas", () => {
    const variant = [1, 2, 3, 4, 5];
    const baseline = [0, 1, 2, 3, 4];
    const ci = pairedDeltaRegretCi(variant, baseline, {
      seed: BATCH4_BOOTSTRAP_SEED,
      B: BATCH4_BOOTSTRAP_B,
      alpha: 0.05
    });
    expect(ci.mean).toBe(1);
    expect(ci.low).toBeLessThanOrEqual(ci.mean);
    expect(ci.high).toBeGreaterThanOrEqual(ci.mean);
    const again = pairedDeltaRegretCi(variant, baseline, {
      seed: BATCH4_BOOTSTRAP_SEED,
      B: BATCH4_BOOTSTRAP_B
    });
    expect(again).toEqual(ci);
  });

  it("flipRateWilson and disjoint intervals", () => {
    const a = flipRateWilson(10, 35);
    expect(a.rate).toBeCloseTo(10 / 35);
    expect(a.wilson.low).toBeLessThanOrEqual(a.wilson.high);
    const tightLow = { low: 0.01, high: 0.1 };
    const tightHigh = { low: 0.5, high: 0.7 };
    expect(wilsonIntervalsDisjoint(tightLow, tightHigh)).toBe(true);
    expect(
      wilsonIntervalsDisjoint({ low: 0.1, high: 0.4 }, { low: 0.3, high: 0.6 })
    ).toBe(false);
  });

  it("A-flip-perturb separable iff flip Wilson intervals are disjoint from noise", () => {
    const same = flipRateWilson(1, 35);
    expect(wilsonIntervalsDisjoint(same.wilson, same.wilson)).toBe(false);
    const low = flipRateWilson(0, 35);
    const high = flipRateWilson(20, 35);
    expect(wilsonIntervalsDisjoint(low.wilson, high.wilson)).toBe(true);
  });

  it("separability decision rules match pre-registration", () => {
    expect(
      separableByDirection({ low: -0.1, high: 0.2 }, "two-sided")
    ).toBe(false);
    expect(separableByDirection({ low: 0.1, high: 0.3 }, "two-sided")).toBe(
      true
    );
    expect(separableByDirection({ low: -0.3, high: -0.1 }, "two-sided")).toBe(
      true
    );
    expect(separableByDirection({ low: 0.05, high: 0.2 }, "worse")).toBe(true);
    expect(separableByDirection({ low: -0.1, high: 0.2 }, "worse")).toBe(false);
    expect(separableByDirection({ low: -0.3, high: -0.05 }, "better")).toBe(
      true
    );
    expect(separableByDirection({ low: -0.1, high: 0.05 }, "better")).toBe(
      false
    );
    expect(
      separableByDirection({ low: 0.1, high: 0.2 }, "noise-baseline")
    ).toBe(false);

    expect(
      separableForComparison({
        direction: "two-sided",
        deltaRegretCi: { low: 0.1, high: 0.3 },
        separableFromNoise: true
      })
    ).toBe(true);
    expect(
      separableForComparison({
        direction: "two-sided",
        deltaRegretCi: { low: 0.1, high: 0.3 },
        separableFromNoise: false
      })
    ).toBe(false);
    expect(
      separableForComparison({
        direction: "worse",
        deltaRegretCi: { low: 0.1, high: 0.3 }
      })
    ).toBe(true);
  });

  it("emptyBatch4RobustnessSummary is a Phase 1 placeholder", () => {
    const empty = emptyBatch4RobustnessSummary();
    expect(empty.schemaVersion).toBe(1);
    expect(empty.preregistrationCommitSha).toBe("");
    expect(empty.bootstrap).toEqual({
      seed: BATCH4_BOOTSTRAP_SEED,
      B: BATCH4_BOOTSTRAP_B,
      alpha: 0.05
    });
    expect(empty.suite).toEqual({ id: "adversarial-heldout-ext", n: 35 });
    expect(empty.comparisons).toEqual([]);
    expect(empty.notes.length).toBeGreaterThan(0);
  });
});
