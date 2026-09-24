import { writeFileSync } from "node:fs";
import { generateResonanceSealSuite } from "../src/env/resonance-seal/generate-suite.ts";

export async function main(): Promise<void> {
  const suite = generateResonanceSealSuite();
  writeFileSync(
    "evals/env-suites/resonance-seal/snapshots.resonance-seal.v1.json",
    `${JSON.stringify(suite, null, 2)}\n`
  );
  console.log(
    `wrote resonance-seal suite n=${suite.n} excludedAllTie=${suite.excludedAllTieCount}`
  );
}
