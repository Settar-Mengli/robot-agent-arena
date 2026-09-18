import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PIVOTAL_MIN_SPREAD,
  PIVOTAL_TARGET_COUNT,
  evalGreedySnapshots,
  evalRandomSnapshots,
  generatePivotalSnapshots,
  selectPivotalSnapshots,
  valueSpread,
  type PivotalDecisionSnapshot,
  type PivotalSnapshotSuite
} from "../eval";

const suitesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../evals/suites"
);

function loadPivotal(name: string): PivotalSnapshotSuite {
  return JSON.parse(
    readFileSync(join(suitesDir, name), "utf8")
  ) as PivotalSnapshotSuite;
}

function snapshotStateKey(snap: PivotalDecisionSnapshot): string {
  return JSON.stringify({
    turn: snap.runtime.session.turn,
    player: snap.runtime.player,
    cpu: snap.runtime.cpu
  });
}

function fakeCandidate(
  id: string,
  spread: number,
  turn = 1
): PivotalDecisionSnapshot {
  return {
    id,
    scenarioId: id.split("__")[0]!,
    runtime: {
      session: { turn }
    },
    playerSkillId: "skill-core-identity",
    cpuConfigId: "c",
    values: {
      "skill-a": spread,
      "skill-b": 0
    },
    best: ["skill-a"],
    exact: true,
    spread
  } as unknown as PivotalDecisionSnapshot;
}

describe("pivotal snapshot selection", () => {
  it("valueSpread is max − min", () => {
    expect(valueSpread({ a: 5, b: 1, c: 3 })).toBe(4);
  });

  it("short-suite path does not throw and warns", () => {
    const candidates = [
      fakeCandidate("s1__t1", 150),
      fakeCandidate("s2__t1", 200),
      fakeCandidate("s3__t1", 50)
    ];
    const selected = selectPivotalSnapshots(candidates);
    expect(selected.count).toBe(2);
    expect(selected.snapshots.map((s) => s.id)).toEqual(["s2__t1", "s1__t1"]);
    expect(selected.warning).toBe(
      `only 2 of ${PIVOTAL_TARGET_COUNT} pivotal points qualified at spread>=${PIVOTAL_MIN_SPREAD}`
    );
  });

  it("selection is deterministic", () => {
    const candidates = [
      fakeCandidate("b__t1", 500, 1),
      fakeCandidate("a__t2", 500, 2),
      fakeCandidate("a__t1", 500, 1),
      fakeCandidate("c__t1", 1000, 1)
    ];
    const once = selectPivotalSnapshots(candidates, { targetCount: 3 });
    const twice = selectPivotalSnapshots(candidates, { targetCount: 3 });
    expect(once.snapshots.map((s) => s.id)).toEqual(
      twice.snapshots.map((s) => s.id)
    );
    expect(once.snapshots.map((s) => s.id)).toEqual([
      "c__t1",
      "a__t1",
      "a__t2"
    ]);
  });

  it("committed pivotal suites respect threshold and count field", () => {
    for (const split of ["dev", "heldout"] as const) {
      const suite = loadPivotal(`snapshots.pivotal.${split}.json`);
      expect(suite.minSpread).toBe(PIVOTAL_MIN_SPREAD);
      expect(suite.targetCount).toBe(PIVOTAL_TARGET_COUNT);
      expect(suite.count).toBe(suite.snapshots.length);
      expect(suite.count).toBeLessThanOrEqual(PIVOTAL_TARGET_COUNT);
      for (const snap of suite.snapshots) {
        expect(snap.spread).toBeGreaterThanOrEqual(PIVOTAL_MIN_SPREAD);
        expect(snap.spread).toBe(valueSpread(snap.values));
        expect(snap.exact).toBe(true);
      }
    }
  });

  it("pivotal dev/heldout state keys are disjoint", () => {
    const dev = loadPivotal("snapshots.pivotal.dev.json");
    const heldout = loadPivotal("snapshots.pivotal.heldout.json");
    const devKeys = new Set(dev.snapshots.map(snapshotStateKey));
    let overlap = 0;
    for (const snap of heldout.snapshots) {
      if (devKeys.has(snapshotStateKey(snap))) {
        overlap += 1;
      }
    }
    expect(overlap).toBe(0);
  });

  it.skipIf(process.env.PIVOTAL_DRIFT !== "1")(
    "drift-guard: generatePivotalSnapshots matches committed JSON (set PIVOTAL_DRIFT=1)",
    () => {
      for (const split of ["dev", "heldout"] as const) {
        const generated = generatePivotalSnapshots(split);
        const committed = loadPivotal(`snapshots.pivotal.${split}.json`);
        expect({
          scenariosScanned: generated.scenariosScanned,
          minSpread: generated.minSpread,
          targetCount: generated.targetCount,
          count: generated.count,
          snapshots: generated.snapshots
        }).toEqual(committed);
      }
    },
    120_000
  );
});

describe("pivotal baselines (informational invariants)", () => {
  it("greedy and random metrics are finite on pivotal suites", () => {
    for (const split of ["dev", "heldout"] as const) {
      const suite = loadPivotal(`snapshots.pivotal.${split}.json`);
      const greedy = evalGreedySnapshots(suite.snapshots);
      const random = evalRandomSnapshots(suite.snapshots);
      expect(greedy.metrics.n).toBe(suite.count);
      expect(Number.isFinite(greedy.metrics.optimalRate)).toBe(true);
      expect(Number.isFinite(random.metrics.meanRegret)).toBe(true);
    }
  });
});
