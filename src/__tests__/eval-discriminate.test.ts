import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  computeDecisionHeadroom,
  decideDiscriminationVerdict,
  intervalsDisjoint,
  runDiscriminationReport,
  summarizeDiscriminationReport,
  SPREAD_THRESHOLD,
  type DiscriminationSplitReport,
  type DiscriminationSummary
} from "../eval/discriminate";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const committedSummaryPath = join(
  root,
  "evals/out-committed/discriminate.summary.json"
);

function loadCommittedSummary(): DiscriminationSummary {
  return JSON.parse(
    readFileSync(committedSummaryPath, "utf8")
  ) as DiscriminationSummary;
}

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

function fmtPct2(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
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

  it("summarizeDiscriminationReport omits spreads and byOpponent", () => {
    const split = fakeSplit({
      winRateCiDisjoint: true,
      nonZeroSpreadRate: 0.5
    });
    split.policies = [
      {
        policy: "greedy",
        aggregate: {
          n: 10,
          rawN: 10,
          strataCovered: 6,
          distinctBattles: 10,
          cpuWinRate: 0.1,
          cpuWinWilson: { low: 0.01, high: 0.4 },
          drawRate: 0,
          lossRate: 0.9,
          meanTurns: 5,
          meanFinalHpMargin: -1
        },
        byOpponent: { "cpu-x": {} as never }
      }
    ];
    const summary = summarizeDiscriminationReport({
      splits: [split],
      verdict: "DISCRIMINATES",
      verdictReason: "test"
    });
    expect(summary.verdict).toBe("DISCRIMINATES");
    expect(summary.splits[0]!.policies[0]!.n).toBe(10);
    expect("spreads" in summary.splits[0]!.headroom).toBe(false);
    expect("byOpponent" in (summary.splits[0]!.policies[0] as object)).toBe(
      false
    );
  });
});

describe("committed discrimination summary vs EVAL.md", () => {
  it("EVAL.md quotes rates from the committed summary", () => {
    const summary = loadCommittedSummary();
    const evalMd = readFileSync(join(root, "EVAL.md"), "utf8");
    expect(summary.verdict).toBe("DISCRIMINATES");
    expect(evalMd).toContain("**Verdict: DISCRIMINATES**");
    const overallPct = (summary.overallNonZeroSpreadRate * 100).toFixed(1);
    expect(evalMd).toContain(`**${overallPct}%**`);

    for (const split of summary.splits) {
      for (const policy of split.policies) {
        expect(evalMd).toContain(fmtPct2(policy.cpuWinRate));
      }
      expect(evalMd).toContain(String(split.headroom.decisionPoints));
      expect(evalMd).toContain(
        `${(split.headroom.flatRate * 100).toFixed(1)}%`
      );
      expect(evalMd).toContain(
        `${(split.headroom.nonZeroSpreadRate * 100).toFixed(1)}%`
      );
    }
  });

  it.skipIf(process.env.SNAPSHOT_DRIFT !== "1")(
    "drift-guard: runDiscriminationReport summary matches committed file (set SNAPSHOT_DRIFT=1)",
    async () => {
      const report = await runDiscriminationReport(() => undefined);
      const generated = summarizeDiscriminationReport(report);
      const committed = loadCommittedSummary();
      expect(generated).toEqual(committed);
    },
    300_000
  );
});
