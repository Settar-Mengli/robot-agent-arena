import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { generateResonanceSealSuite } from "../env/resonance-seal/generate-suite";
import { sealMemoStateKey, type SealState } from "../env/resonance-seal";

const SUITE = join(
  process.cwd(),
  "evals/env-suites/resonance-seal/snapshots.resonance-seal.v1.json"
);

function readLf(path: string): string {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

describe("resonance-seal-suite-drift", () => {
  it("committed suite matches generator (LF byte-eq) and is informative", () => {
    const regenerated = generateResonanceSealSuite();
    const expected = `${JSON.stringify(regenerated, null, 2)}\n`;
    expect(readLf(SUITE)).toBe(expected);

    expect(regenerated.n).toBe(40);
    expect(regenerated.snapshots).toHaveLength(40);

    const keys = new Set<string>();
    for (const row of regenerated.snapshots) {
      const key = sealMemoStateKey(row.state as SealState);
      expect(keys.has(key)).toBe(false);
      keys.add(key);

      // No all-tie rows
      const legalVals = Object.entries(row.values)
        .filter(([, v]) => Number.isFinite(v) && (v as number) > -1e11)
        .map(([, v]) => v as number);
      if (legalVals.length > 1) {
        const first = legalVals[0]!;
        const allEqual = legalVals.every((v) => Math.abs(v - first) < 1e-9);
        expect(allEqual).toBe(false);
      }
    }
  });
});
