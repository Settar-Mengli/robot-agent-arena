import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BATCH4_PREREG_SHA,
  buildBatch4RobustnessSummary,
  buildLeaderboardV1,
  loadArmSeries,
  loadFixtureIndex,
  stableStringify,
  type Batch4ArmId,
  type Batch4PinId,
  type Batch4RobustnessSummaryV1,
  type DecisionSnapshot
} from "../eval";
import { wilsonInterval } from "../decision-lab/stats";

const SUMMARY = join(
  process.cwd(),
  "evals/out-committed/batch4.robustness.summary.json"
);
const UI_SUMMARY = join(
  process.cwd(),
  "src/ui/data/batch4.robustness.summary.json"
);
const LEADERBOARD = join(process.cwd(), "src/ui/data/leaderboard.v1.json");
const MARKER = join(
  process.cwd(),
  "evals/out-committed/batch4.phase2.marker.json"
);
const SUITE = join(
  process.cwd(),
  "evals/suites/snapshots.adversarial.heldout-ext.json"
);
const ADV_SUITE = join(
  process.cwd(),
  "evals/suites/snapshots.adversarial.heldout.json"
);
const FIXTURES = join(process.cwd(), "evals/fixtures");

function readLf(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

/** Rebuild leaderboard.v1.json exactly as scripts/gen-batch4-phase2.ts. */
function rebuildLeaderboard(snapshots: readonly DecisionSnapshot[]): unknown {
  const fixtures = loadFixtureIndex(FIXTURES);
  const arms: Batch4ArmId[] = [
    "base",
    "grounded",
    "base-repeat",
    "perturb",
    "advctx",
    "info-partial"
  ];
  const pins: Batch4PinId[] = ["gemini", "groq"];
  const extRows = [];
  for (const pin of pins) {
    for (const arm of arms) {
      const series = loadArmSeries(snapshots, pin, arm, fixtures);
      const rate = series.optimalCount / series.decisions.length;
      const wilson = wilsonInterval(
        series.optimalCount,
        series.decisions.length
      );
      extRows.push({
        id: `${pin}:${arm}`,
        label: `${pin} ${arm}`,
        n: series.decisions.length,
        rate,
        wilson
      });
    }
  }

  const adv = JSON.parse(readLf(ADV_SUITE)) as {
    snapshots: DecisionSnapshot[];
  };
  const advRows = [];
  for (const pin of pins) {
    for (const arm of ["base", "grounded"] as const) {
      const series = loadArmSeries(adv.snapshots, pin, arm, fixtures);
      const rate = series.optimalCount / series.decisions.length;
      advRows.push({
        id: `${pin}:${arm}:secondary`,
        label: `${pin} ${arm} (smaller set)`,
        n: 13,
        rate,
        wilson: wilsonInterval(series.optimalCount, series.decisions.length)
      });
    }
  }

  const leaderboard = buildLeaderboardV1({
    suites: [
      {
        suiteId: "adversarial-heldout-ext",
        label: "Held-out extended (35 cases)",
        rows: extRows
      },
      {
        suiteId: "adversarial",
        label: "Held-out adversarial (13 cases)",
        rows: advRows
      }
    ]
  });
  delete leaderboard.generatedAt;
  return leaderboard;
}

describe("batch4 drift", () => {
  it(
    "Phase 2 hard mode: summary + leaderboard byte-equality; groq flip not separable",
    () => {
    expect(existsSync(MARKER), "phase2 marker required").toBe(true);
    expect(existsSync(SUMMARY), "batch4 summary required").toBe(true);
    expect(existsSync(UI_SUMMARY), "UI batch4 summary required").toBe(true);
    expect(existsSync(LEADERBOARD), "leaderboard.v1 required").toBe(true);

    const marker = JSON.parse(readLf(MARKER)) as {
      complete?: boolean;
      preregistrationCommitSha?: string;
    };
    expect(marker.complete).toBe(true);
    expect(marker.preregistrationCommitSha).toBe(BATCH4_PREREG_SHA);

    const suite = JSON.parse(readLf(SUITE)) as {
      snapshots: DecisionSnapshot[];
    };
    const rebuilt = buildBatch4RobustnessSummary({
      snapshots: suite.snapshots,
      fixturesDir: FIXTURES
    });
    expect(readLf(SUMMARY)).toBe(stableStringify(rebuilt));
    expect(readLf(UI_SUMMARY)).toBe(readLf(SUMMARY));

    const rebuiltLb = rebuildLeaderboard(suite.snapshots);
    expect(readLf(LEADERBOARD)).toBe(stableStringify(rebuiltLb));

    const summary = JSON.parse(readLf(SUMMARY)) as Batch4RobustnessSummaryV1;
    expect(summary.schemaVersion).toBe(1);
    expect(summary.comparisons).toHaveLength(14);
    expect(summary.bootstrap.seed).toBe(0xa11ce);
    expect(summary.bootstrap.B).toBe(2000);

    const gemFlip = summary.comparisons.find(
      (c) => c.id === "gemini/A-flip-perturb"
    );
    const groqFlip = summary.comparisons.find(
      (c) => c.id === "groq/A-flip-perturb"
    );
    const gemNoise = summary.comparisons.find(
      (c) => c.id === "gemini/A-flip-noise"
    );
    const groqNoise = summary.comparisons.find(
      (c) => c.id === "groq/A-flip-noise"
    );
    expect(gemFlip?.flipRateVariantVsBase).toBe(0);
    expect(gemFlip?.separable).toBe(false);
    expect(gemNoise?.flipRateVariantVsBase).toBe(0);
    expect(gemNoise?.separable).toBe(false);
    expect(groqFlip?.flipRateVariantVsBase).toBeCloseTo(1 / 35);
    expect(groqFlip?.separable).toBe(false);
    expect(groqFlip?.separableFromNoise).toBe(false);
    expect(groqNoise?.flipRateVariantVsBase).toBeCloseTo(1 / 35);
    expect(groqNoise?.separable).toBe(false);
  },
  60_000
  );
});
