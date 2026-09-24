/**
 * Generate Batch 4 Phase 2 committed artifacts (summary, UI copy, leaderboard, marker).
 * Usage: npx tsx scripts/gen-batch4-phase2.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditFlipCounts,
  buildBatch4RobustnessSummary,
  loadArmSeries,
  loadFixtureIndex,
  stableStringify,
  BATCH4_PREREG_SHA,
  type Batch4ArmId,
  type Batch4PinId
} from "../src/eval/batch4-analyze.ts";
import { buildLeaderboardV1 } from "../src/eval/leaderboard-pack.ts";
import { wilsonInterval } from "../src/decision-lab/stats.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function writeLf(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text.replace(/\r\n/g, "\n"), "utf8");
}

function main(): void {
  const suitePath = join(
    ROOT,
    "evals/suites/snapshots.adversarial.heldout-ext.json"
  );
  const suite = JSON.parse(readFileSync(suitePath, "utf8")) as {
    snapshots: Parameters<typeof buildBatch4RobustnessSummary>[0]["snapshots"];
  };
  const fixturesDir = join(ROOT, "evals/fixtures");

  const summary = buildBatch4RobustnessSummary({
    snapshots: suite.snapshots,
    fixturesDir
  });

  const flips = auditFlipCounts(summary);
  console.log("flip audit:", JSON.stringify(flips));

  const committedSummary = join(
    ROOT,
    "evals/out-committed/batch4.robustness.summary.json"
  );
  const uiSummary = join(ROOT, "src/ui/data/batch4.robustness.summary.json");
  const body = stableStringify(summary);
  writeLf(committedSummary, body);
  writeLf(uiSummary, body);

  const fixtures = loadFixtureIndex(fixturesDir);
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
      const series = loadArmSeries(suite.snapshots, pin, arm, fixtures);
      const rate = series.optimalCount / series.decisions.length;
      const wilson = wilsonInterval(series.optimalCount, series.decisions.length);
      extRows.push({
        id: `${pin}:${arm}`,
        label: `${pin} ${arm}`,
        n: series.decisions.length,
        rate,
        wilson
      });
    }
  }

  // Secondary n=13: existing adversarial heldout base/grounded only (always insufficient).
  const advPath = join(
    ROOT,
    "evals/suites/snapshots.adversarial.heldout.json"
  );
  const adv = JSON.parse(readFileSync(advPath, "utf8")) as {
    snapshots: typeof suite.snapshots;
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
  // Drop generatedAt for byte-stable drift.
  delete leaderboard.generatedAt;

  const lbPath = join(ROOT, "src/ui/data/leaderboard.v1.json");
  writeLf(lbPath, stableStringify(leaderboard));

  const markerPath = join(
    ROOT,
    "evals/out-committed/batch4.phase2.marker.json"
  );
  writeLf(
    markerPath,
    stableStringify({
      complete: true,
      preregistrationCommitSha: BATCH4_PREREG_SHA
    })
  );

  console.log("wrote", committedSummary);
  console.log("wrote", uiSummary);
  console.log("wrote", lbPath);
  console.log("wrote", markerPath);
  console.log("comparisons", summary.comparisons.length);
}

main();
