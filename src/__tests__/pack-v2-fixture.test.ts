import { describe, expect, it } from "vitest";
import { assertDecisionLabPackV2 } from "../decision-lab";
import v2Fixture from "../ui/lab/__fixtures__/decision-lab.v2.json";

describe("pack-v2 fixture still asserts", () => {
  it("loads frozen v2 fixture", () => {
    const pack = assertDecisionLabPackV2(v2Fixture);
    expect(pack.schemaVersion).toBe(2);
    expect(pack.cases.length).toBeGreaterThan(0);
  });
});
