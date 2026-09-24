/**
 * Non-degeneracy gates on the committed Resonance Seal suite (D-052).
 * greedy≠oracle is reported (measured) but not gated at a fixed error rate.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEnvRng } from "../env";
import {
  applySealAction,
  isSealTerminal,
  sealBestResponse,
  sealGreedyAction,
  sealLegalActions,
  sealRandomAction,
  type SealActionId,
  type SealState
} from "../env/resonance-seal";

type SealSuiteRow = {
  id: string;
  state: SealState;
  values: Record<SealActionId, number>;
  best: SealActionId[];
  exact: true;
};

type SealSuiteV1 = {
  n: number;
  snapshots: SealSuiteRow[];
};

const SUITE_PATH = join(
  process.cwd(),
  "evals/env-suites/resonance-seal/snapshots.resonance-seal.v1.json"
);

function canReachWin(state: SealState): boolean {
  const visited = new Set<string>();
  function dfs(s: SealState): boolean {
    if (s.seal >= 3) return true;
    if (isSealTerminal(s)) return false;
    const key = [
      s.turn,
      s.energy,
      s.seal,
      s.pressure,
      s.bracedLastTurn ? 1 : 0
    ].join("|");
    if (visited.has(key)) return false;
    visited.add(key);
    for (const a of sealLegalActions(s)) {
      if (dfs(applySealAction(s, a))) return true;
    }
    return false;
  }
  return dfs(state);
}

describe("resonance-seal-nondegeneracy", () => {
  it("suite passes non-degeneracy gates", () => {
    const suite = JSON.parse(readFileSync(SUITE_PATH, "utf8")) as SealSuiteV1;
    expect(suite.n).toBe(40);
    expect(suite.snapshots).toHaveLength(40);

    const bestCounts = new Map<SealActionId, number>();
    const distinctBest = new Set<SealActionId>();
    let greedySuboptimal = 0;
    let winReachable = 0;

    for (const row of suite.snapshots) {
      for (const a of row.best) {
        distinctBest.add(a);
        bestCounts.set(a, (bestCounts.get(a) ?? 0) + 1);
      }

      const greedy = sealGreedyAction(row.state);
      if (!row.best.includes(greedy)) {
        greedySuboptimal += 1;
      }
      if (canReachWin(row.state)) {
        winReachable += 1;
      }

      const live = sealBestResponse(row.state);
      expect(live.best.slice().sort()).toEqual(row.best.slice().sort());
    }

    expect(distinctBest.size).toBeGreaterThanOrEqual(3);

    for (const [, count] of bestCounts) {
      expect(count / suite.n).toBeLessThanOrEqual(0.8);
    }

    const greedyNeqOracleRate = greedySuboptimal / suite.n;
    // Measured only — not a fixed error-rate gate (D-052 pre-publication change).
    expect(greedyNeqOracleRate).toBeGreaterThan(0);
    expect(winReachable / suite.n).toBeGreaterThanOrEqual(0.25);

    const rng = createEnvRng(0x5ea1);
    let randomNeq = 0;
    for (const row of suite.snapshots) {
      const pick = sealRandomAction(row.state, rng);
      if (!row.best.includes(pick)) randomNeq += 1;
    }
    expect(randomNeq / suite.n).toBeGreaterThanOrEqual(0.25);

    console.info(
      JSON.stringify({
        distinctBest: distinctBest.size,
        maxMonopoly: Math.max(...[...bestCounts.values()].map((c) => c / suite.n)),
        greedyNeqOracleRate,
        randomNeqOracleRate: randomNeq / suite.n,
        winReachableRate: winReachable / suite.n
      })
    );
  });
});
