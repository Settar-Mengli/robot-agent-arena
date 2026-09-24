import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Paths listed in .github/workflows/ci.yml protected-path check. */
const PROTECTED_PATHS = [
  "src/engine",
  "src/agent/prompt.ts",
  "src/agent/prompt-batch4.ts",
  "evals/fixtures",
  "src/ui/lab/pack/decision-lab.v3.json",
  "src/ui/arena/pack/arena-replay.v1.json",
  "src/ui/lab/pack/diagnostics.summary.json",
  "evals/out-committed/bench.summary.json",
  "evals/out-committed/batch4.robustness.summary.json",
  "src/ui/data/batch4.robustness.summary.json",
  "src/ui/data/leaderboard.v1.json",
  "evals/env-suites/resonance-seal/snapshots.resonance-seal.v1.json",
  "evals/out-committed/resonance-seal.baselines.v1.json",
  "evals/out-committed/adversarial.baselines.json",
  "evals/out-committed/adversarial.heldout-ext.baselines.json",
  "evals/out-committed/batch4.phase2.marker.json",
  "evals/out-committed/bench.live-profile.json",
  "evals/out-committed/diagnostics.summary.json",
  "evals/out-committed/discriminate.summary.json",
  "src/ui/arena/pack/schema.ts",
  "src/ui/data/quickstart-robot.ts",
  "src/__tests__/env-robot.test.ts",
  "src/__tests__/eval-snapshots.test.ts",
  "src/__tests__/env-differential.test.ts",
  "src/decision-lab/diagnostics.ts",
  "src/eval/lab-pack.ts",
  "package.json",
  "package-lock.json"
] as const;

describe("CI protected-path list", () => {
  it("ci.yml lists every protected path and each exists on disk", () => {
    const yml = readFileSync(".github/workflows/ci.yml", "utf8");
    for (const p of PROTECTED_PATHS) {
      expect(yml, `ci.yml missing ${p}`).toContain(p);
      expect(existsSync(p), `missing on disk: ${p}`).toBe(true);
    }
  });
});
