import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ADVERSARIAL_MIN_REGRET,
  ADVERSARIAL_TARGET_COUNT,
  deltaVsSuiteBaseline,
  evalGreedySnapshots,
  evalRandomSnapshots,
  generateAdversarialSnapshots,
  metricsForChosenMoves,
  pickBestByCatalogOrder,
  regret,
  selectAdversarialSnapshots,
  type AdversarialDecisionSnapshot,
  type AdversarialSnapshotSuite,
  type DecisionSnapshot,
  type SnapshotPolicyMetrics
} from "../eval";
import type { SkillId } from "../engine";

const suitesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../evals/suites"
);

const driftEnabled =
  process.env.SNAPSHOT_DRIFT === "1" || process.env.PIVOTAL_DRIFT === "1";

function loadAdversarial(name: string): AdversarialSnapshotSuite {
  return JSON.parse(
    readFileSync(join(suitesDir, name), "utf8")
  ) as AdversarialSnapshotSuite;
}

function snapshotStateKey(snap: AdversarialDecisionSnapshot): string {
  return JSON.stringify({
    turn: snap.runtime.session.turn,
    player: snap.runtime.player,
    cpu: snap.runtime.cpu
  });
}

function fakeCandidate(
  id: string,
  greedyRegret: number,
  turn = 1
): AdversarialDecisionSnapshot {
  return {
    id,
    scenarioId: id.split("__")[0]!,
    runtime: {
      session: { turn }
    },
    playerSkillId: "skill-core-identity",
    cpuConfigId: "c",
    values: {
      "skill-a": greedyRegret,
      "skill-b": 0
    },
    best: ["skill-a"],
    exact: true,
    spread: greedyRegret,
    greedyRegret,
    greedySkillId: "skill-b"
  } as unknown as AdversarialDecisionSnapshot;
}

function evalCatalogOptimalSnapshots(
  snapshots: readonly DecisionSnapshot[]
): ReturnType<typeof metricsForChosenMoves> {
  const chosen: SkillId[] = [];
  for (const snap of snapshots) {
    chosen.push(
      pickBestByCatalogOrder(
        snap.best,
        snap.runtime.session.cpu.skillIds,
        snap.runtime.cpu.energy
      )
    );
  }
  return metricsForChosenMoves(snapshots, chosen);
}

describe("adversarial snapshot selection", () => {
  it("short-suite path does not throw and warns", () => {
    const candidates = [
      fakeCandidate("s1__t1", 150),
      fakeCandidate("s2__t1", 200),
      fakeCandidate("s3__t1", 0)
    ];
    const selected = selectAdversarialSnapshots(candidates);
    expect(selected.count).toBe(2);
    expect(selected.snapshots.map((s) => s.id)).toEqual(["s2__t1", "s1__t1"]);
    expect(selected.warning).toBe(
      `only 2 of ${ADVERSARIAL_TARGET_COUNT} adversarial points qualified at greedyRegret>=${ADVERSARIAL_MIN_REGRET}`
    );
  });

  it("selection is deterministic", () => {
    const candidates = [
      fakeCandidate("b__t1", 500, 1),
      fakeCandidate("a__t2", 500, 2),
      fakeCandidate("a__t1", 500, 1),
      fakeCandidate("c__t1", 1000, 1)
    ];
    const once = selectAdversarialSnapshots(candidates, { targetCount: 3 });
    const twice = selectAdversarialSnapshots(candidates, { targetCount: 3 });
    expect(once.snapshots.map((s) => s.id)).toEqual(
      twice.snapshots.map((s) => s.id)
    );
    expect(once.snapshots.map((s) => s.id)).toEqual([
      "c__t1",
      "a__t1",
      "a__t2"
    ]);
  });

  it("committed adversarial suites respect threshold and count field", () => {
    for (const split of ["dev", "heldout"] as const) {
      const suite = loadAdversarial(`snapshots.adversarial.${split}.json`);
      expect(suite.minRegret).toBe(ADVERSARIAL_MIN_REGRET);
      expect(suite.targetCount).toBe(ADVERSARIAL_TARGET_COUNT);
      expect(suite.count).toBe(suite.snapshots.length);
      expect(suite.count).toBeLessThanOrEqual(ADVERSARIAL_TARGET_COUNT);
      for (const snap of suite.snapshots) {
        expect(snap.greedyRegret).toBeGreaterThanOrEqual(ADVERSARIAL_MIN_REGRET);
        expect(snap.greedyRegret).toBe(
          regret(snap.values, snap.greedySkillId)
        );
        expect(snap.exact).toBe(true);
        expect(snap.runtime.turns).toBeDefined();
      }
    }
  });

  it("adversarial dev/heldout state keys are disjoint", () => {
    const dev = loadAdversarial("snapshots.adversarial.dev.json");
    const heldout = loadAdversarial("snapshots.adversarial.heldout.json");
    const devKeys = new Set(dev.snapshots.map(snapshotStateKey));
    let overlap = 0;
    for (const snap of heldout.snapshots) {
      if (devKeys.has(snapshotStateKey(snap))) {
        overlap += 1;
      }
    }
    expect(overlap).toBe(0);
  });

  it("greedy optimalRate is 0 on committed adversarial suites (by construction)", () => {
    for (const split of ["dev", "heldout"] as const) {
      const suite = loadAdversarial(`snapshots.adversarial.${split}.json`);
      const greedy = evalGreedySnapshots(suite.snapshots);
      expect(greedy.metrics.optimalRate).toBe(0);
      expect(greedy.metrics.meanRegret).toBeGreaterThan(0);
    }
  });

  it("random and catalog-optimal baselines behave as expected", () => {
    for (const split of ["dev", "heldout"] as const) {
      const suite = loadAdversarial(`snapshots.adversarial.${split}.json`);
      const random = evalRandomSnapshots(suite.snapshots);
      const optimal = evalCatalogOptimalSnapshots(suite.snapshots);
      expect(Number.isFinite(random.metrics.optimalRate)).toBe(true);
      expect(optimal.optimalRate).toBe(1);
      expect(optimal.meanRegret).toBe(0);
    }
  });

  it("suite baseline deltas use measured adversarial greedy, not standard 50%/0.50", () => {
    const suite = loadAdversarial("snapshots.adversarial.heldout.json");
    const greedy = evalGreedySnapshots(suite.snapshots);
    expect(greedy.metrics.optimalRate).toBe(0);
    expect(greedy.metrics.meanRegret).toBeCloseTo(104.35, 1);
    // Must not match the old hardcoded standard-suite baseline.
    expect(greedy.metrics.optimalRate).not.toBe(0.5);
    expect(greedy.metrics.meanRegret).not.toBe(0.5);

    const llmLike: SnapshotPolicyMetrics = {
      n: suite.count,
      optimalRate: 0.05,
      meanRegret: 4.25,
      medianRegret: 5,
      maxRegret: 5,
      highRegretCount: 0
    };
    const delta = deltaVsSuiteBaseline(
      "grounded",
      "heldout:adversarial",
      "greedy",
      llmLike,
      greedy.metrics
    );
    expect(delta.baseline.optimalRate).toBe(greedy.metrics.optimalRate);
    expect(delta.baseline.meanRegret).toBe(greedy.metrics.meanRegret);
    expect(delta.deltaOptimalRate).toBeCloseTo(0.05, 5);
    expect(delta.deltaMeanRegret).toBeCloseTo(4.25 - greedy.metrics.meanRegret, 5);
    // Old bug would have reported Δoptimal=-45pp using standard 50%.
    expect(delta.deltaOptimalRate).not.toBeCloseTo(0.05 - 0.5, 5);
  });

  it("committed adversarial.baselines.json matches regen from suites", () => {
    const committedPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../evals/out-committed/adversarial.baselines.json"
    );
    const committed = JSON.parse(readFileSync(committedPath, "utf8")) as Record<
      string,
      {
        greedy: SnapshotPolicyMetrics;
        random: SnapshotPolicyMetrics;
      }
    >;

    for (const split of ["dev", "heldout"] as const) {
      const suite = loadAdversarial(`snapshots.adversarial.${split}.json`);
      const greedy = evalGreedySnapshots(suite.snapshots).metrics;
      const random = evalRandomSnapshots(suite.snapshots).metrics;
      const pick = (m: SnapshotPolicyMetrics) => ({
        n: m.n,
        optimalRate: m.optimalRate,
        meanRegret: m.meanRegret,
        medianRegret: m.medianRegret,
        maxRegret: m.maxRegret,
        highRegretCount: m.highRegretCount
      });
      expect(committed[split]).toEqual({
        greedy: pick(greedy),
        random: pick(random)
      });
    }
  });

  it.skipIf(!driftEnabled)(
    "drift-guard: generateAdversarialSnapshots matches committed JSON (set SNAPSHOT_DRIFT=1)",
    () => {
      for (const split of ["dev", "heldout"] as const) {
        const generated = generateAdversarialSnapshots(split);
        const committed = loadAdversarial(
          `snapshots.adversarial.${split}.json`
        );
        expect({
          scenariosScanned: generated.scenariosScanned,
          minRegret: generated.minRegret,
          targetCount: generated.targetCount,
          count: generated.count,
          snapshots: generated.snapshots
        }).toEqual(committed);
      }
    },
    180_000
  );
});
