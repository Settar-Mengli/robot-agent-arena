import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  decisionStateKey,
  generateAdversarialHeldoutExtSnapshots,
  type DecisionSnapshot
} from "../src/eval/snapshots";

function loadKeys(rel: string, set: Set<string>): void {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), rel), "utf8")
  ) as { snapshots: DecisionSnapshot[] };
  for (const snap of raw.snapshots) {
    set.add(decisionStateKey(snap.runtime, snap.playerSkillId));
  }
}

export async function main(): Promise<void> {
  const forbidden = new Set<string>();
  for (const f of [
    "evals/suites/snapshots.dev.json",
    "evals/suites/snapshots.heldout.json",
    "evals/suites/snapshots.pivotal.dev.json",
    "evals/suites/snapshots.pivotal.heldout.json",
    "evals/suites/snapshots.adversarial.dev.json",
    "evals/suites/snapshots.adversarial.heldout.json"
  ]) {
    loadKeys(f, forbidden);
  }

  const suite = generateAdversarialHeldoutExtSnapshots({
    forbiddenStateKeys: forbidden
  });

  let leaks = 0;
  for (const snap of suite.snapshots) {
    if (forbidden.has(decisionStateKey(snap.runtime, snap.playerSkillId))) {
      leaks += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        count: suite.count,
        targetCount: suite.targetCount,
        seedBand: suite.seedBand,
        seedsUsed: suite.seedsUsed,
        warning: suite.warning,
        scenariosScanned: suite.scenariosScanned,
        leakage: leaks
      },
      null,
      2
    )
  );

  const outPath = join(
    process.cwd(),
    "evals/suites/snapshots.adversarial.heldout-ext.json"
  );
  writeFileSync(outPath, `${JSON.stringify(suite, null, 2)}\n`, "utf8");
  console.log(`wrote ${outPath}`);
}
