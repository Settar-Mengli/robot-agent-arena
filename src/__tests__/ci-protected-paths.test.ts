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

const WORKFLOWS = [
  ".github/workflows/ci.yml",
  ".github/workflows/pages.yml"
] as const;

const SHA40 = /^[a-f0-9]{40}$/;

describe("CI protected-path list", () => {
  it("ci.yml lists every protected path and each exists on disk", () => {
    const yml = readFileSync(".github/workflows/ci.yml", "utf8");
    for (const p of PROTECTED_PATHS) {
      expect(yml, `ci.yml missing ${p}`).toContain(p);
      expect(existsSync(p), `missing on disk: ${p}`).toBe(true);
    }
  });
});

describe("GitHub Actions SHA pins", () => {
  it("every uses: line is pinned to a 40-char commit SHA", () => {
    for (const file of WORKFLOWS) {
      const yml = readFileSync(file, "utf8");
      const usesLines = yml
        .split(/\r?\n/)
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => /^\s*-\s*uses:\s*\S+/.test(line));
      expect(usesLines.length, `${file} has no uses:`).toBeGreaterThan(0);
      for (const { line, n } of usesLines) {
        const m = line.match(/uses:\s*([^@\s]+)@([^\s#]+)/);
        expect(m, `${file}:${n} unparseable uses: ${line}`).not.toBeNull();
        const sha = m![2];
        expect(
          SHA40.test(sha),
          `${file}:${n} not 40-char SHA: ${sha}`
        ).toBe(true);
      }
    }
  });
});
