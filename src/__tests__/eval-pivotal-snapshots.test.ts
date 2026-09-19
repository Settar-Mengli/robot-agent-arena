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
  turn = 1,
  playerHp = 10
): PivotalDecisionSnapshot {
  return {
    id,
    scenarioId: id.split("__")[0]!,
    runtime: {
      session: { turn },
      player: { health: playerHp, energy: 1, defense: 0 },
      cpu: { health: 10, energy: 2, defense: 0 }
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
      fakeCandidate("s1__t1", 150, 1, 1),
      fakeCandidate("s2__t1", 200, 1, 2),
      fakeCandidate("s3__t1", 50, 1, 3)
    ];
    const selected = selectPivotalSnapshots(candidates);
    expect(selected.count).toBe(2);
    expect(selected.snapshots.map((s) => s.id)).toEqual(["s2__t1", "s1__t1"]);
    expect(selected.warning).toBe(
      `only 2 of ${PIVOTAL_TARGET_COUNT} distinct pivotal states qualified at spread>=${PIVOTAL_MIN_SPREAD}`
    );
  });

  it("selection is deterministic and skips duplicate states", () => {
    const candidates = [
      fakeCandidate("b__t1", 500, 1, 1),
      fakeCandidate("a__t2", 500, 2, 2),
      fakeCandidate("a__t1", 500, 1, 3),
      fakeCandidate("c__t1", 1000, 1, 4),
      fakeCandidate("clone__t1", 999, 1, 4) // same state as c__t1 (turn/hp/skill)
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
      expect(suite.distinctStateCount).toBe(suite.snapshots.length);
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

  it.skipIf(process.env.PIVOTAL_DRIFT !== "1" && process.env.SNAPSHOT_DRIFT !== "1")(
    "drift-guard: generatePivotalSnapshots matches committed JSON (set PIVOTAL_DRIFT=1 or SNAPSHOT_DRIFT=1)",
    () => {
      for (const split of ["dev", "heldout"] as const) {
        const generated = generatePivotalSnapshots(split);
        const committed = loadPivotal(`snapshots.pivotal.${split}.json`);
        expect({
          scenariosScanned: generated.scenariosScanned,
          minSpread: generated.minSpread,
          targetCount: generated.targetCount,
          count: generated.count,
          distinctStateCount: generated.distinctStateCount,
          snapshots: generated.snapshots,
          ...(generated.warning !== undefined
            ? { warning: generated.warning }
            : {})
        }).toEqual(committed);
      }
    },
    120_000
  );
});

describe("pivotal baselines (informational invariants)", () => {
  it("greedy metrics pin published pivotal baselines", () => {
    // EVAL.md pivotal baselines after D-035 distinct-state regen
    const expected = {
      dev: { optimalRate: 0.875, meanRegret: 250.125 },
      heldout: { optimalRate: 0.875, meanRegret: 250.25 }
    } as const;
    for (const split of ["dev", "heldout"] as const) {
      const suite = loadPivotal(`snapshots.pivotal.${split}.json`);
      const greedy = evalGreedySnapshots(suite.snapshots);
      const random = evalRandomSnapshots(suite.snapshots);
      expect(greedy.metrics.n).toBe(suite.count);
      expect(greedy.metrics.optimalRate).toBe(expected[split].optimalRate);
      expect(greedy.metrics.meanRegret).toBeCloseTo(expected[split].meanRegret, 2);
      expect(Number.isFinite(random.metrics.meanRegret)).toBe(true);
    }
  });

  it("committed pivotal suites pin spread min/median/max (even-count median)", () => {
    // Local copy of metrics.ts medianOf (not exported; fence forbids editing metrics.ts).
    function medianOf(values: readonly number[]): number {
      if (values.length === 0) {
        return 0;
      }
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 1) {
        return sorted[mid]!;
      }
      return (sorted[mid - 1]! + sorted[mid]!) / 2;
    }

    const expected: Record<
      "dev" | "heldout",
      { min: number; median: number; max: number }
    > = {
      dev: { min: 2001, median: 2003, max: 2007 },
      heldout: { min: 2002, median: 2005, max: 2008 }
    };

    for (const split of ["dev", "heldout"] as const) {
      const suite = loadPivotal(`snapshots.pivotal.${split}.json`);
      const spreads = suite.snapshots.map((s) => s.spread);
      const min = Math.min(...spreads);
      const max = Math.max(...spreads);
      const median = medianOf(spreads);
      expect({ min, median, max }).toEqual(expected[split]);
    }
  });
});
