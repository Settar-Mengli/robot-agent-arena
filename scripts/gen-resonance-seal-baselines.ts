import { readFileSync, writeFileSync } from "node:fs";
import { createEnvRng } from "../src/env/seed-rng.ts";
import {
  resonanceSealEnvironment,
  sealBestResponse,
  sealGreedyAction,
  sealRandomAction,
  type SealActionId,
  type SealState
} from "../src/env/resonance-seal/index.ts";
import { evaluateChoices } from "../src/eval/evaluate-choices.ts";
import { insufficientEvidence } from "../src/decision-lab/stats.ts";

type SealSuiteRow = {
  id: string;
  state: SealState;
  values: Record<SealActionId, number>;
  best: SealActionId[];
  exact: true;
};

type SealSuiteV1 = {
  schemaVersion: 1;
  id: "resonance-seal-v1";
  n: number;
  excludedAllTieCount: number;
  snapshots: SealSuiteRow[];
};

function pickMetrics(m: {
  n: number;
  optimalRate: number;
  meanRegret: number;
  optimalRateWilson: { low: number; high: number };
  meanRegretCi: { low: number; high: number };
}) {
  return {
    n: m.n,
    optimalRate: m.optimalRate,
    meanRegret: m.meanRegret,
    optimalRateWilson: m.optimalRateWilson,
    meanRegretCi: m.meanRegretCi,
    insufficientEvidence: insufficientEvidence({
      n: m.n,
      wilson: m.optimalRateWilson
    })
  };
}

export async function main(): Promise<void> {
  const suite = JSON.parse(
    readFileSync(
      "evals/env-suites/resonance-seal/snapshots.resonance-seal.v1.json",
      "utf8"
    )
  ) as SealSuiteV1;

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

  const out = {
    schemaVersion: 1,
    id: "resonance-seal.baselines.v1",
    n: suite.n,
    excludedAllTieCount: suite.excludedAllTieCount,
    greedy: pickMetrics(greedy.metrics),
    random: pickMetrics(random.metrics),
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

  writeFileSync(
    "evals/out-committed/resonance-seal.baselines.v1.json",
    `${JSON.stringify(out, null, 2)}\n`
  );
  console.log(
    `wrote seal baselines greedy.opt=${out.greedy.optimalRate.toFixed(3)} random.opt=${out.random.optimalRate.toFixed(3)}`
  );
}
