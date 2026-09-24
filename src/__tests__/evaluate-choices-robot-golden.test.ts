import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { robotEnvironmentOf } from "../env";
import {
  evaluateChoices,
  metricsForChosenMoves,
  type DecisionSnapshot
} from "../eval";
import type { SkillId } from "../engine";

const SUITE = join(
  process.cwd(),
  "evals/suites/snapshots.adversarial.heldout-ext.json"
);

describe("evaluate-choices-robot-golden", () => {
  it("evaluateChoices on heldout suite equals metricsForChosenMoves exactly", () => {
    const suite = JSON.parse(readFileSync(SUITE, "utf8")) as {
      snapshots: DecisionSnapshot[];
    };
    const snapshots = suite.snapshots;
    expect(snapshots.length).toBeGreaterThanOrEqual(30);

    // Mix optimal + non-optimal choices so the golden is not all-zeros regret.
    const chosen: SkillId[] = snapshots.map((snap, i) => {
      if (i % 4 === 0) {
        const keys = Object.keys(snap.values) as SkillId[];
        const alt = keys.find((k) => !snap.best.includes(k));
        return alt ?? snap.best[0]!;
      }
      return snap.best[0]!;
    });

    const expected = metricsForChosenMoves(snapshots, chosen);

    const result = evaluateChoices({
      env: robotEnvironmentOf,
      cases: snapshots.map((s) => ({ id: s.id, state: s.runtime })),
      policy: (state) => {
        const idx = snapshots.findIndex((s) => s.runtime === state);
        if (idx < 0) throw new Error("state not in golden suite");
        return chosen[idx]!;
      },
      oracle: (state) => {
        const idx = snapshots.findIndex((s) => s.runtime === state);
        if (idx < 0) throw new Error("state not in golden suite");
        const snap = snapshots[idx]!;
        return { values: snap.values, best: snap.best, exact: true };
      }
    });

    expect(result.metrics).toEqual(expected);
    expect(result.perCase).toHaveLength(snapshots.length);
  });
});
