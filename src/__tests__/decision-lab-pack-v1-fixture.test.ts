import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertDecisionLabPackV1 } from "../decision-lab";

describe("decision-lab pack v1 assert (fixture only)", () => {
  it("accepts committed v1 test fixture", () => {
    const raw = JSON.parse(
      readFileSync(
        join(process.cwd(), "src/ui/lab/__fixtures__/decision-lab.v1.json"),
        "utf8"
      )
    );
    const pack = assertDecisionLabPackV1(raw);
    expect(pack.schemaVersion).toBe(1);
    expect(pack.cases.length).toBeGreaterThan(0);
  });
});
