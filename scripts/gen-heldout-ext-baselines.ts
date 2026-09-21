import { readFileSync, writeFileSync } from "node:fs";
import { evalGreedySnapshots, evalRandomSnapshots } from "../src/eval/snapshot-eval.ts";

export async function main(): Promise<void> {
  const raw = JSON.parse(
    readFileSync("evals/suites/snapshots.adversarial.heldout-ext.json", "utf8")
  ) as { snapshots: Parameters<typeof evalGreedySnapshots>[0] };

  const pick = (m: {
    n: number;
    optimalRate: number;
    meanRegret: number;
    medianRegret: number;
    maxRegret: number;
    highRegretCount: number;
  }) => ({
    n: m.n,
    optimalRate: m.optimalRate,
    meanRegret: m.meanRegret,
    medianRegret: m.medianRegret,
    maxRegret: m.maxRegret,
    highRegretCount: m.highRegretCount
  });

  const greedy = evalGreedySnapshots(raw.snapshots).metrics;
  const random = evalRandomSnapshots(raw.snapshots).metrics;
  const out = {
    "heldout-ext": { greedy: pick(greedy), random: pick(random) }
  };
  writeFileSync(
    "evals/out-committed/adversarial.heldout-ext.baselines.json",
    `${JSON.stringify(out, null, 2)}\n`
  );
  console.log(`wrote heldout-ext baselines n=${greedy.n}`);
}
