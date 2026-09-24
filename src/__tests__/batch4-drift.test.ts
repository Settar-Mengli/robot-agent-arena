import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Batch4RobustnessSummaryV1 } from "../eval";

const SUMMARY = join(
  process.cwd(),
  "evals/out-committed/batch4.robustness.summary.json"
);
const LEADERBOARD = join(process.cwd(), "src/ui/data/leaderboard.v1.json");
const MARKER = join(
  process.cwd(),
  "evals/out-committed/batch4.phase2.marker.json"
);

function readPhase2Marker(): { complete?: boolean } | null {
  if (!existsSync(MARKER)) {
    return null;
  }
  return JSON.parse(readFileSync(MARKER, "utf8")) as { complete?: boolean };
}

describe("batch4 drift", () => {
  it("Phase 1 skip-if-absent; Phase 2 marker complete ⇒ hard assert", () => {
    const marker = readPhase2Marker();
    if (marker?.complete !== true) {
      // Phase 1: summary/leaderboard/marker may be absent — skip OK.
      return;
    }

    expect(
      existsSync(SUMMARY),
      "batch4.robustness.summary.json required when phase2 marker complete"
    ).toBe(true);
    expect(
      existsSync(LEADERBOARD),
      "leaderboard.v1.json required when phase2 marker complete"
    ).toBe(true);

    const summary = JSON.parse(
      readFileSync(SUMMARY, "utf8")
    ) as Batch4RobustnessSummaryV1;
    expect(summary.schemaVersion).toBe(1);
    expect(summary.bootstrap.seed).toBe(0xa11ce);
    expect(summary.bootstrap.B).toBe(2000);
    expect(summary.bootstrap.alpha).toBe(0.05);
    expect(typeof summary.preregistrationCommitSha).toBe("string");
    expect(Array.isArray(summary.comparisons)).toBe(true);

    const leaderboard = JSON.parse(readFileSync(LEADERBOARD, "utf8")) as {
      schemaVersion: number;
    };
    expect(leaderboard.schemaVersion).toBe(1);
  });
});
