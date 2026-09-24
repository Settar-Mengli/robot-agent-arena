import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEnvRng } from "../env";
import {
  resonanceSealEnvironment,
  sealBestResponse,
  sealGreedyAction,
  sealRandomAction,
  type SealActionId,
  type SealState
} from "../env/resonance-seal";
import { evaluateChoices } from "../eval";
import { insufficientEvidence } from "../decision-lab";

const SUITE = join(
  process.cwd(),
  "evals/env-suites/resonance-seal/snapshots.resonance-seal.v1.json"
);
const BASELINES = join(
  process.cwd(),
  "evals/out-committed/resonance-seal.baselines.v1.json"
);

function readLf(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

type SealSuiteRow = {
  id: string;
  state: SealState;
  values: Record<SealActionId, number>;
  best: SealActionId[];
};

function rebuildBaselines(suite: {
  n: number;
  excludedAllTieCount: number;
  snapshots: SealSuiteRow[];
}): unknown {
  const cases = suite.snapshots.map((s) => ({ id: s.id, state: s.state }));
  const oracle = (state: SealState) => sealBestResponse(state);
  const greedy = evaluateChoices({
    env: resonanceSealEnvironment,
    cases,
    policy: sealGreedyAction,
    oracle
  });
  const rng = createEnvRng(0x5ea17011);
  const random = evaluateChoices({
    env: resonanceSealEnvironment,
    cases,
    policy: (state) => sealRandomAction(state, rng),
    oracle
  });

  const pick = (m: typeof greedy.metrics) => ({
    n: m.n,
    optimalRate: m.optimalRate,
    meanRegret: m.meanRegret,
    optimalRateWilson: m.optimalRateWilson,
    meanRegretCi: m.meanRegretCi,
    insufficientEvidence: insufficientEvidence({
      n: m.n,
      wilson: m.optimalRateWilson
    })
  });

  const oracleBestActionDistribution: Record<string, number> = {};
  let spreadSum = 0;
  let spreadMax = 0;
  let greedyNeq = 0;
  let randomNeq = 0;
  const rng2 = createEnvRng(0x5ea17011);
  for (const row of suite.snapshots) {
    for (const a of row.best) {
      oracleBestActionDistribution[a] =
        (oracleBestActionDistribution[a] ?? 0) + 1;
    }
    const legal = resonanceSealEnvironment.legalActions(row.state);
    const vals = legal.map((a) => row.values[a]!).filter(Number.isFinite);
    const spread =
      vals.length === 0 ? 0 : Math.max(...vals) - Math.min(...vals);
    spreadSum += spread;
    if (spread > spreadMax) spreadMax = spread;
    if (!row.best.includes(sealGreedyAction(row.state))) greedyNeq += 1;
    if (!row.best.includes(sealRandomAction(row.state, rng2))) randomNeq += 1;
  }

  return {
    schemaVersion: 1,
    id: "resonance-seal.baselines.v1",
    n: suite.n,
    excludedAllTieCount: suite.excludedAllTieCount,
    greedy: pick(greedy.metrics),
    random: pick(random.metrics),
    oracleBestActionDistribution,
    greedyNeqOracleRate: greedyNeq / suite.n,
    randomNeqOracleRate: randomNeq / suite.n,
    meanActionValueSpread: spreadSum / suite.n,
    maxActionValueSpread: spreadMax,
    notes: [
      "Resonance Seal regret scale differs from the robot battle - never compare across environments.",
      "Seal is not on the leaderboard.",
      "Oracle = exact best response to a fixed vault pressure script (not an equilibrium).",
      "Shared: EnvironmentOf, evaluateChoices, aggregateChoiceMetrics, wilsonInterval/bootstrapMeanCi/insufficientEvidence.",
      "Not shared: LLM prompt/agent path.",
      "Plan greedy (inscribe-preferring) is pre-declared; greedy!=oracle is measured (not a fixed error-rate gate)."
    ]
  };
}

describe("resonance-seal-baselines-drift", () => {
  it("committed baselines match rebuild (LF byte-eq)", () => {
    const suite = JSON.parse(readLf(SUITE)) as {
      n: number;
      excludedAllTieCount: number;
      snapshots: SealSuiteRow[];
    };
    const rebuilt = rebuildBaselines(suite);
    const expected = `${JSON.stringify(rebuilt, null, 2)}\n`;
    expect(readLf(BASELINES)).toBe(expected);
  });
});
