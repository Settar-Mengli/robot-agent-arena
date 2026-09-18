import { describe, expect, it } from "vitest";
import {
  computeDecisionHeadroom,
  decideDiscriminationVerdict,
  intervalsDisjoint,
  SPREAD_THRESHOLD,
  type DiscriminationSplitReport
} from "../eval/discriminate";

function fakeSplit(input: {
  winRateCiDisjoint: boolean;
  nonZeroSpreadRate: number;
  split?: "dev" | "heldout";
}): DiscriminationSplitReport {
  const points = 100;
  const flatCount = Math.round((1 - input.nonZeroSpreadRate) * points);
  const spreads =
    input.nonZeroSpreadRate > 0
      ? Array.from({ length: points - flatCount }, () => 1)
      : [];
  return {
    split: input.split ?? "dev",
    policies: [],
    headroom: computeDecisionHeadroom(
      spreads,
      flatCount,
      0,
      points
    ),
    optimalInexactTurns: 0,
    winRateCiDisjoint: input.winRateCiDisjoint
  };
}

describe("discrimination helpers", () => {
  it("intervalsDisjoint detects overlap and separation", () => {
    expect(
      intervalsDisjoint({ low: 0.1, high: 0.2 }, { low: 0.3, high: 0.4 })
    ).toBe(true);
    expect(
      intervalsDisjoint({ low: 0.1, high: 0.35 }, { low: 0.3, high: 0.4 })
    ).toBe(false);
  });

  it("verdict DISCRIMINATES when CI disjoint and spread > threshold", () => {
    const { verdict } = decideDiscriminationVerdict([
      fakeSplit({
        winRateCiDisjoint: true,
        nonZeroSpreadRate: SPREAD_THRESHOLD + 0.1
      })
    ]);
    expect(verdict).toBe("DISCRIMINATES");
  });

  it("verdict DOES_NOT_DISCRIMINATE when CIs overlap", () => {
    const { verdict, reason } = decideDiscriminationVerdict([
      fakeSplit({
        winRateCiDisjoint: false,
        nonZeroSpreadRate: 0.9
      })
    ]);
    expect(verdict).toBe("DOES_NOT_DISCRIMINATE");
    expect(reason).toMatch(/overlap/);
  });

  it("verdict DOES_NOT_DISCRIMINATE when spread too low", () => {
    const { verdict, reason } = decideDiscriminationVerdict([
      fakeSplit({
        winRateCiDisjoint: true,
        nonZeroSpreadRate: SPREAD_THRESHOLD
      })
    ]);
    expect(verdict).toBe("DOES_NOT_DISCRIMINATE");
    expect(reason).toMatch(/non-zero value spread/);
  });

  it("computeDecisionHeadroom is deterministic", () => {
    const a = computeDecisionHeadroom([3, 1, 2], 1, 2, 4);
    const b = computeDecisionHeadroom([3, 1, 2], 1, 2, 4);
    expect(a).toEqual(b);
    expect(a.flatRate).toBe(0.25);
    expect(a.greedySuboptimalRate).toBe(0.5);
    expect(a.medianSpread).toBe(2);
  });
});
