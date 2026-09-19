import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  decisionStateKey,
  generateSnapshots,
  takeDistinctByState,
  type DecisionSnapshot,
  type SnapshotSuite
} from "../eval";

const suitesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../evals/suites"
);

function loadSuite(name: string): SnapshotSuite {
  return JSON.parse(
    readFileSync(join(suitesDir, name), "utf8")
  ) as SnapshotSuite;
}

function snapKey(snap: DecisionSnapshot): string {
  return decisionStateKey(snap.runtime, snap.playerSkillId);
}

describe("decision snapshot suites", () => {
  it(
    "drift-guard: generateSnapshots matches committed JSON",
    () => {
      for (const split of ["dev", "heldout"] as const) {
        const generated = generateSnapshots(split);
        const committed = loadSuite(`snapshots.${split}.json`);
        expect(generated).toEqual(committed);
      }
    },
    120_000
  );

  it("each split has exact discriminative snapshots with honest count fields", () => {
    const dev = loadSuite("snapshots.dev.json");
    const heldout = loadSuite("snapshots.heldout.json");

    for (const suite of [dev, heldout]) {
      expect(suite.targetCount).toBe(20);
      expect(suite.count).toBe(suite.snapshots.length);
      expect(suite.distinctStateCount).toBe(suite.snapshots.length);
      expect(suite.count).toBeLessThanOrEqual(suite.targetCount);
      expect(suite.scenariosScanned).toBeGreaterThanOrEqual(12);
      for (const snap of suite.snapshots) {
        expect(snap.exact).toBe(true);
        const vals = Object.values(snap.values);
        expect(new Set(vals).size).toBeGreaterThan(1);
        expect(snap.best.length).toBeGreaterThan(0);
      }
    }

    const seedOf = (scenarioId: string): number => {
      const m = /__s(\d+)$/.exec(scenarioId);
      return m ? Number(m[1]) : NaN;
    };

    const devSeeds = new Set(dev.snapshots.map((s) => seedOf(s.scenarioId)));
    const heldoutSeeds = new Set(
      heldout.snapshots.map((s) => seedOf(s.scenarioId))
    );
    for (const seed of devSeeds) {
      expect(heldoutSeeds.has(seed)).toBe(false);
    }
  });

  it("dev and heldout standard suites remain seed-disjoint (state overlap allowed)", () => {
    const dev = loadSuite("snapshots.dev.json");
    const heldout = loadSuite("snapshots.heldout.json");
    const seedOf = (scenarioId: string): number => {
      const m = /__s(\d+)$/.exec(scenarioId);
      return m ? Number(m[1]) : NaN;
    };
    const devSeeds = new Set(dev.snapshots.map((s) => seedOf(s.scenarioId)));
    for (const snap of heldout.snapshots) {
      expect(devSeeds.has(seedOf(snap.scenarioId))).toBe(false);
    }
    // D-035 invariant is within-suite uniqueness; cross-split combat-state
    // clones can occur when distinct seeds reach the same HP/energy/defense.
  });

  it("committed suites assert distinctStateCount and unique decision states (D-035)", () => {
    const files = readdirSync(suitesDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const file of files) {
      const suite = JSON.parse(
        readFileSync(join(suitesDir, file), "utf8")
      ) as SnapshotSuite;
      expect(suite.distinctStateCount).toBe(suite.snapshots.length);
      expect(suite.count).toBe(suite.snapshots.length);
      const keys = suite.snapshots.map(snapKey);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("takeDistinctByState keeps highest-ranked instance per state", () => {
    const mk = (
      id: string,
      turn: number,
      hp: number
    ): DecisionSnapshot =>
      ({
        id,
        scenarioId: id,
        runtime: {
          session: { turn },
          player: { health: hp, energy: 1, defense: 0 },
          cpu: { health: 10, energy: 2, defense: 0 }
        },
        playerSkillId: "skill-core-identity"
      }) as unknown as DecisionSnapshot;

    const ranked = [
      mk("best", 1, 5),
      mk("clone", 1, 5),
      mk("other", 2, 5)
    ];
    const got = takeDistinctByState(ranked, 20);
    expect(got.map((s) => s.id)).toEqual(["best", "other"]);
  });
});
