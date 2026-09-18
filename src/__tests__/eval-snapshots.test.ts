import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { generateSnapshots } from "../eval";
import type { SnapshotSuite } from "../eval";

const suitesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../evals/suites"
);

function loadSuite(name: string): SnapshotSuite {
  return JSON.parse(
    readFileSync(join(suitesDir, name), "utf8")
  ) as SnapshotSuite;
}

function snapshotStateKey(snap: SnapshotSuite["snapshots"][number]): string {
  return JSON.stringify({
    turn: snap.runtime.session.turn,
    player: snap.runtime.player,
    cpu: snap.runtime.cpu
  });
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
    60_000
  );

  it("each split has 20 exact discriminative snapshots with disjoint seeds", () => {
    const dev = loadSuite("snapshots.dev.json");
    const heldout = loadSuite("snapshots.heldout.json");

    expect(dev.snapshots).toHaveLength(20);
    expect(heldout.snapshots).toHaveLength(20);
    expect(dev.scenariosScanned).toBeGreaterThanOrEqual(12);
    expect(heldout.scenariosScanned).toBeGreaterThanOrEqual(12);

    for (const snap of [...dev.snapshots, ...heldout.snapshots]) {
      expect(snap.exact).toBe(true);
      const vals = Object.values(snap.values);
      expect(new Set(vals).size).toBeGreaterThan(1);
      expect(snap.best.length).toBeGreaterThan(0);
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

  it("dev and heldout snapshot state-key sets are disjoint", () => {
    const dev = loadSuite("snapshots.dev.json");
    const heldout = loadSuite("snapshots.heldout.json");
    const devKeys = new Set(dev.snapshots.map(snapshotStateKey));
    let overlap = 0;
    for (const snap of heldout.snapshots) {
      if (devKeys.has(snapshotStateKey(snap))) {
        overlap += 1;
      }
    }
    expect(overlap).toBe(0);
  });
});
