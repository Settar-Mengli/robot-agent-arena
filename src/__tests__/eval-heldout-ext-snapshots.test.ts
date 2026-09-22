import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decisionStateKey,
  generateAdversarialHeldoutExtSnapshots,
  type DecisionSnapshot
} from "../eval/snapshots";
import { evalGreedySnapshots, evalRandomSnapshots } from "../eval/snapshot-eval";

const SUITE_PATH = join(
  process.cwd(),
  "evals/suites/snapshots.adversarial.heldout-ext.json"
);

function loadKeys(rel: string, set: Set<string>): void {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), rel), "utf8")
  ) as { snapshots: DecisionSnapshot[] };
  for (const snap of raw.snapshots) {
    set.add(decisionStateKey(snap.runtime, snap.playerSkillId));
  }
}

describe("heldout-ext adversarial suite (D-044)", () => {
  const committed = JSON.parse(readFileSync(SUITE_PATH, "utf8")) as {
    count: number;
    targetCount: number;
    distinctStateCount: number;
    seedBand: string;
    warning?: string;
    snapshots: DecisionSnapshot[];
  };

  it("ships honest n with widen-once band and distinct states", () => {
    expect(committed.targetCount).toBe(40);
    expect(committed.count).toBe(committed.snapshots.length);
    expect(committed.distinctStateCount).toBe(committed.count);
    expect(committed.seedBand).toBe("201-280");
    expect(committed.count).toBeLessThanOrEqual(40);
    if (committed.count < 40) {
      expect(committed.warning).toMatch(/only \d+ of 40/);
    }
  });

  it("has zero decisionStateKey leakage vs existing suites", () => {
    const forbidden = new Set<string>();
    for (const f of [
      "evals/suites/snapshots.dev.json",
      "evals/suites/snapshots.heldout.json",
      "evals/suites/snapshots.pivotal.dev.json",
      "evals/suites/snapshots.pivotal.heldout.json",
      "evals/suites/snapshots.adversarial.dev.json",
      "evals/suites/snapshots.adversarial.heldout.json"
    ]) {
      loadKeys(f, forbidden);
    }
    for (const snap of committed.snapshots) {
      expect(forbidden.has(decisionStateKey(snap.runtime, snap.playerSkillId))).toBe(
        false
      );
    }
  });

  it("greedy optimalRate is 0 by construction", () => {
    const greedy = evalGreedySnapshots(committed.snapshots);
    expect(greedy.metrics.optimalRate).toBe(0);
  });

  it("committed heldout-ext baselines match regen", () => {
    const baselines = JSON.parse(
      readFileSync(
        join(process.cwd(), "evals/out-committed/adversarial.heldout-ext.baselines.json"),
        "utf8"
      )
    ) as {
      "heldout-ext": {
        greedy: { n: number; optimalRate: number; meanRegret: number };
        random: { n: number; optimalRate: number; meanRegret: number };
      };
    };
    const greedy = evalGreedySnapshots(committed.snapshots).metrics;
    const random = evalRandomSnapshots(committed.snapshots).metrics;
    expect(baselines["heldout-ext"].greedy.n).toBe(greedy.n);
    expect(baselines["heldout-ext"].greedy.optimalRate).toBe(greedy.optimalRate);
    expect(baselines["heldout-ext"].greedy.meanRegret).toBe(greedy.meanRegret);
    expect(baselines["heldout-ext"].random.n).toBe(random.n);
    expect(baselines["heldout-ext"].random.optimalRate).toBe(random.optimalRate);
    expect(baselines["heldout-ext"].random.meanRegret).toBe(random.meanRegret);
  });

  it.skipIf(process.env.SNAPSHOT_DRIFT !== "1")(
    "drift-guard: generateAdversarialHeldoutExtSnapshots ≡ committed",
    () => {
      const forbidden = new Set<string>();
      for (const f of [
        "evals/suites/snapshots.dev.json",
        "evals/suites/snapshots.heldout.json",
        "evals/suites/snapshots.pivotal.dev.json",
        "evals/suites/snapshots.pivotal.heldout.json",
        "evals/suites/snapshots.adversarial.dev.json",
        "evals/suites/snapshots.adversarial.heldout.json"
      ]) {
        loadKeys(f, forbidden);
      }
      const generated = generateAdversarialHeldoutExtSnapshots({
        forbiddenStateKeys: forbidden
      });
      expect({
        scenariosScanned: generated.scenariosScanned,
        minRegret: generated.minRegret,
        targetCount: generated.targetCount,
        count: generated.count,
        distinctStateCount: generated.distinctStateCount,
        seedBand: generated.seedBand,
        seedsUsed: generated.seedsUsed,
        snapshots: generated.snapshots,
        ...(generated.warning !== undefined ? { warning: generated.warning } : {})
      }).toEqual(committed);
    },
    600_000
  );
});
