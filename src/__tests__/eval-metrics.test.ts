import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findSkillDefinition,
  MVP_SKILL_CATALOG
} from "../engine";
import {
  percentile,
  randomPolicyExpectation,
  wilsonInterval,
  evalGreedySnapshots,
  evalRandomSnapshots
} from "../eval";
import type { DecisionSnapshot, SnapshotSuite } from "../eval";

const suite = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../../evals/suites/snapshots.dev.json"
    ),
    "utf8"
  )
) as SnapshotSuite;

describe("eval metrics", () => {
  it("Wilson CI matches known values", () => {
    const { low, high } = wilsonInterval(50, 100);
    expect(low).toBeCloseTo(0.4038, 3);
    expect(high).toBeCloseTo(0.5962, 3);
  });

  it("percentiles", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([], 50)).toBeNull();
  });

  it("random-policy expectation matches brute-force averaging", () => {
    const snap = suite.snapshots[0]!;
    const exp = randomPolicyExpectation(snap);

    const energy = snap.runtime.cpu.energy;
    const skillIds = snap.runtime.session.cpu.skillIds;
    const affordable = skillIds.filter((id) => {
      const skill = findSkillDefinition(MVP_SKILL_CATALOG, id);
      return skill !== undefined && skill.energyCost <= energy;
    });
    const candidates = affordable.length > 0 ? affordable : [skillIds[0]!];
    const best = new Set(snap.best);
    const optimalRate =
      candidates.filter((id) => best.has(id)).length / candidates.length;
    expect(exp.optimalRate).toBe(optimalRate);
  });

  it("greedy and random snapshot evals return finite metrics", () => {
    const snapshots: DecisionSnapshot[] = suite.snapshots.slice(0, 5);
    const random = evalRandomSnapshots(snapshots);
    const greedy = evalGreedySnapshots(snapshots);
    expect(random.metrics.n).toBe(5);
    expect(greedy.metrics.optimalRate).toBeGreaterThanOrEqual(0);
    expect(greedy.metrics.optimalRate).toBeLessThanOrEqual(1);
  });
});
